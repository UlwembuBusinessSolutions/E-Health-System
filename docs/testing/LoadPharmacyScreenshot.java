import java.net.URI;
import java.net.http.*;
import java.sql.*;
import java.time.Duration;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import com.fasterxml.jackson.databind.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/** Explicit local screenshot fixtures. Never run against production.
 * Clinical clearance here represents synthetic example states only.
 * Stock receipts, reviews and partial supply go through the real HTTP API.
 * The setup identity is disabled, unlicensed and its tokens revoked on exit.
 */
class LoadPharmacyScreenshot {
 static final ObjectMapper JSON=new ObjectMapper();
 static final HttpClient HTTP=HttpClient.newHttpClient();
 static final String BASE=System.getenv().getOrDefault("LIVE_API_BASE","http://localhost:8084");
 static final UUID CLINIC=UUID.fromString("98e1948d-18bd-4381-91c1-8f4cec392fa2");
 static final UUID ACTOR=id("setup");
 static String token;
 static UUID id(String key){return UUID.nameUUIDFromBytes(("local-pharmacy-screenshot:"+key).getBytes(StandardCharsets.UTF_8));}
 static void sql(Connection c,String query,Object...values)throws Exception{
  try(var s=c.prepareStatement(query)){for(int i=0;i<values.length;i++)s.setObject(i+1,values[i]);s.executeUpdate();}
 }
 static long number(Connection c,String query,Object...values)throws Exception{
  try(var s=c.prepareStatement(query)){for(int i=0;i<values.length;i++)s.setObject(i+1,values[i]);try(var r=s.executeQuery()){r.next();return r.getLong(1);}}
 }
 static UUID uuid(Connection c,String query,Object...values)throws Exception{
  try(var s=c.prepareStatement(query)){for(int i=0;i<values.length;i++)s.setObject(i+1,values[i]);try(var r=s.executeQuery()){return r.next()?r.getObject(1,UUID.class):null;}}
 }
 static JsonNode call(String method,String path,Object body,int expected)throws Exception{
  var b=HttpRequest.newBuilder(URI.create(BASE+path)).timeout(Duration.ofSeconds(120)).header("X-Tenant-ID","amo");
  if(token!=null)b.header("Authorization","Bearer "+token);
  if(body!=null)b.header("Content-Type","application/json");
  var response=HTTP.send(b.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body))).build(),HttpResponse.BodyHandlers.ofString());
  if(response.statusCode()!=expected)throw new IllegalStateException(method+" "+path+" returned "+response.statusCode()+": "+response.body());
  System.out.println("PASS: "+method+" "+path+" HTTP "+expected);
  return response.body().isBlank()?JSON.nullNode():JSON.readTree(response.body());
 }
 static void require(boolean ok,String description){if(!ok)throw new IllegalStateException(description);System.out.println("PASS: "+description);}
 public static void main(String[]args)throws Exception{
  if(!"LOCAL_SAMPLE_DATA".equals(System.getenv("PHARMACY_SCREENSHOT_SETUP")))throw new IllegalArgumentException("Explicit local sample setup flag required");
  try(var c=DriverManager.getConnection(System.getenv("LIVE_DB_URL"),"postgres",System.getenv("LIVE_DB_PASSWORD"))){
   sql(c,"set search_path to amo");
   require(number(c,"select count(*) from facilities where id=? and name='sosha' and active",CLINIC)==1,"Target is the existing sosha clinic");
   String password=UUID.randomUUID()+"Aa1!", hash=new BCryptPasswordEncoder(12).encode(password);
   try{
    sql(c,"insert into users(id,employee_number,email,first_name,last_name,contact_number,password_hash,facility_id,status,sapc_number,sapc_expiry_date) values(?,'SCREEN-SETUP','pharmacy-screen-setup@example.invalid','Local Sample','Setup','+27000000900',?,?,'ACTIVE','TEST-SCREENSHOT-ONLY',CURRENT_DATE+1) on conflict(id) do update set password_hash=EXCLUDED.password_hash,status='ACTIVE',sapc_number=EXCLUDED.sapc_number,sapc_expiry_date=EXCLUDED.sapc_expiry_date",ACTOR,hash,CLINIC);
    sql(c,"insert into user_roles(user_id,role_id) select ?,id from roles where name='ORG_ADMIN' on conflict do nothing",ACTOR);
    token=call("POST","/api/v1/auth/login",Map.of("email","pharmacy-screen-setup@example.invalid","password",password),200).get("accessToken").asText();
    String[] first={"Lerato","Sipho","Naledi"},last={"Mokoena","Nkosi","Mokoena"};
    String[] mpi={"MPI-00018421","MPI-00018422","MPI-00018452"};
    String[] doctors={"Dr N.","Dr P.","Nurse K."}, surnames={"Dlamini","Maseko","Molefe"};
    String[] medicines={"Amlodipine 5 mg","Amoxicillin 500 mg","Metformin 500 mg"};
    String[] codes={"FORM-AML5","FORM-AMX500","FORM-MET500"},units={"TABLET","CAPSULE","TABLET"};
    String[] lots={"AML-26-04","AMX-26-02","MET-26-01"},expiry={"2027-04-30","2027-02-28","2027-06-30"};
    int[] packs={30,21,60},stocks={184,72,90};
    var items=new ArrayList<UUID>();
    for(int i=0;i<3;i++){
     String serial="RX-2026-0009"+(i+1), key="row-"+i;
     UUID doctor=id(key+"-doctor"),patient=id(key+"-patient"),visit=id(key+"-visit"),rx=id(key+"-rx"),item=id(key+"-item");
     require(number(c,"select count(*) from prescriptions where serial_number=? and id<>?",serial,rx)==0,"Reference "+serial+" does not overwrite another prescription");
     require(number(c,"select count(*) from patients where mpi_number=? and id<>?",mpi[i],patient)==0,"MPI "+mpi[i]+" does not overwrite another patient");
     UUID product=uuid(c,"select id from pharmacy_products where code_normalized=?",codes[i]);
     if(product==null){
      var payload=new HashMap<String,Object>();payload.put("code",codes[i]);payload.put("displayName",medicines[i]);payload.put("category","MEDICINE");payload.put("baseUnit",units[i]);payload.put("packSize",packs[i]);payload.put("batchTracked",true);payload.put("expiryTracked",true);payload.put("facilityId",CLINIC);payload.put("reorderThreshold",i==0?50:20);
      product=UUID.fromString(call("POST","/api/v1/pharmacy/products",payload,201).get("id").asText());
     }
     require(number(c,"select count(*) from pharmacy_products where id=? and display_name=? and base_unit=? and pack_size=? and active",product,medicines[i],units[i],packs[i])==1,"Matching active product "+codes[i]);
     sql(c,"insert into pharmacy_facility_products(product_id,facility_id,reorder_threshold,created_at) values(?,?,?,now()) on conflict(product_id,facility_id) do nothing",product,CLINIC,i==0?50:20);
     String receiptRef="LOCAL-SCREENSHOT-"+serial;
     if(number(c,"select count(*) from pharmacy_receipts where facility_id=? and source_reference=?",CLINIC,receiptRef)==0)
      call("POST","/api/v1/pharmacy/receipts",Map.of("facilityId",CLINIC,"sourceReference",receiptRef,"supplierName","Synthetic local screenshot fixture","lines",List.of(Map.of("productId",product,"manufacturer","LOCAL SCREENSHOT SAMPLE","lotNumber",lots[i],"expiryDate",expiry[i],"expiryPrecision","DAY","baseQuantity",stocks[i]))),201);
     c.setAutoCommit(false);
     try{
      sql(c,"insert into users(id,employee_number,email,first_name,last_name,contact_number,password_hash,facility_id,status) values(?,?,?,?,?,?,?,?,'DISABLED') on conflict(id) do nothing",doctor,"SCREEN-DR-"+i,"screen-prescriber-"+i+"@example.invalid",doctors[i],surnames[i],"+2700000091"+i,"DISABLED-SYNTHETIC-SCREENSHOT-IDENTITY",CLINIC);
      sql(c,"insert into patients(id,mpi_number,first_name,last_name,date_of_birth,gender,citizenship_status,id_number,address,contact_number) values(?,?,?,?,'1990-01-01',?,'SA_CITIZEN',?,'SYNTHETIC LOCAL SCREENSHOT SAMPLE - not a real patient','+27000000000') on conflict(id) do nothing",patient,mpi[i],first[i],last[i],i==1?"MALE":"FEMALE","990000000009"+i);
      sql(c,"insert into visits(id,patient_id,facility_id,visit_type,service_stream,visit_datetime,created_by_user_id) values(?,?,?,'NEW','PHARMACY',now(),?) on conflict(id) do nothing",visit,patient,CLINIC,ACTOR);
      sql(c,"insert into prescriptions(id,serial_number,visit_id,patient_id,facility_id,prescriber_id) values(?,?,?,?,?,?) on conflict(id) do nothing",rx,serial,visit,patient,CLINIC,doctor);
      sql(c,"insert into prescription_items(id,prescription_id,drug_name,dosage,quantity,product_id,clinical_check_status,clinical_check_note) values(?,?,?,'LOCAL SAMPLE ONLY - not treatment instructions',?,?,'REVIEW_REQUIRED',?) on conflict(id) do nothing",item,rx,medicines[i],packs[i],product,i==1?"Interaction check required":"Synthetic screenshot example; review not recorded yet");
      sql(c,"insert into audit_log(user_id,facility_id,action,entity_type,entity_id,after_value) select ?,?,'LOCAL_SCREENSHOT_SAMPLE_SETUP','Prescription',?,?::jsonb where not exists(select 1 from audit_log where action='LOCAL_SCREENSHOT_SAMPLE_SETUP' and entity_id=?)",ACTOR,CLINIC,rx.toString(),JSON.writeValueAsString(Map.of("synthetic",true,"source","User requested screenshot examples","serialNumber",serial)),rx.toString());
      c.commit();
     }catch(Exception e){c.rollback();throw e;}finally{c.setAutoCommit(true);}
     if(i!=1 && number(c,"select count(*) from prescription_items where id=? and clinical_check_status='PASSED'",item)==0)
      call("POST","/api/v1/prescriptions/"+rx+"/items/"+item+"/review",Map.of("productId",product,"status","PASSED","note","SYNTHETIC LOCAL SCREENSHOT SAMPLE: example cleared state only; not an actual clinical assessment."),204);
     if(i==0 && number(c,"select dispensed_quantity from prescription_items where id=?",item)==0){
      UUID batch=uuid(c,"select id from pharmacy_batches where product_id=? and manufacturer='LOCAL SCREENSHOT SAMPLE' and lot_number=?",product,lots[i]);
      UUID location=uuid(c,"select id from pharmacy_stock_locations where facility_id=? and code='MAIN'",CLINIC);
      call("POST","/api/v1/prescriptions/"+rx+"/items/"+item+"/dispense",Map.of("productId",product,"batchId",batch,"locationId",location,"quantity",10),204);
     }
     items.add(item);
    }
    UUID paracetamol=uuid(c,"select id from pharmacy_products where code_normalized='FORM-PAR5'");
    if(paracetamol==null) {
     var payload=new HashMap<String,Object>();
     payload.put("code","FORM-PAR5");payload.put("displayName","Paracetamol 500 mg");payload.put("category","MEDICINE");payload.put("baseUnit","TABLET");payload.put("packSize",24);payload.put("batchTracked",true);payload.put("expiryTracked",true);payload.put("facilityId",CLINIC);payload.put("reorderThreshold",60);
     paracetamol=UUID.fromString(call("POST","/api/v1/pharmacy/products",payload,201).get("id").asText());
    }
    require(number(c,"select count(*) from pharmacy_products where id=? and display_name='Paracetamol 500 mg' and base_unit='TABLET' and active",paracetamol)==1,"Matching screenshot Paracetamol product");
    if(number(c,"select count(*) from pharmacy_receipts where facility_id=? and source_reference='LOCAL-SCREENSHOT-PAR5'",CLINIC)==0)
     call("POST","/api/v1/pharmacy/receipts",Map.of("facilityId",CLINIC,"sourceReference","LOCAL-SCREENSHOT-PAR5","supplierName","Synthetic local screenshot fixture","lines",List.of(Map.of("productId",paracetamol,"manufacturer","LOCAL SCREENSHOT SAMPLE","lotNumber","PAR-25-11","expiryDate","2026-09-15","expiryPrecision","DAY","baseQuantity",96))),201);
    var stockPositions=call("GET","/api/v1/pharmacy/stock/positions?facilityId="+CLINIC,null,200);
    require(stockPositions.get("items").size()>=4,"Four screenshot stock products are persisted");
    var queue=call("GET","/api/v1/prescriptions/queue?facilityId="+CLINIC,null,200);
    require(queue.get("items").size()>=3,"Queue contains screenshot records");
    require(number(c,"select quantity-dispensed_quantity from prescription_items where id=?",items.get(0))==20,"Lerato has 20 tablets remaining");
    require(number(c,"select count(*) from prescription_items where id=? and clinical_check_status='REVIEW_REQUIRED' and quantity=21",items.get(1))==1,"Sipho requires review for 21 capsules");
    require(number(c,"select count(*) from prescription_items where id=? and clinical_check_status='PASSED' and quantity-dispensed_quantity=60",items.get(2))==1,"Naledi ready for 60 tablets");
    require(number(c,"select count(*) from pharmacy_stock_accounts a where a.location_id in (select id from pharmacy_stock_locations where facility_id=?) and a.quantity<>(select coalesce(sum(e.quantity_delta),0) from pharmacy_stock_entries e where e.stock_account_id=a.id)",CLINIC)==0,"Clinic stock balances equal ledger totals");
    Files.writeString(Path.of("target/pharmacy-screenshot-fixture.json"),JSON.writeValueAsString(Map.of("token",token,"facilityId",CLINIC,"items",items)));
    int browserExit=new ProcessBuilder("node","docs/testing/pharmacy-screenshot-live.cjs").inheritIO().start().waitFor();
    require(browserExit==0,"Real browser screenshot rows and actions");
    System.out.println("COMPLETE: three persistent synthetic screenshot prescriptions loaded through real stock/review/dispense APIs.");
   }finally{
    Files.deleteIfExists(Path.of("target/pharmacy-screenshot-fixture.json"));
    sql(c,"update users set status='DISABLED',sapc_number=null,sapc_expiry_date=null,token_version=token_version+1 where id=?",ACTOR);
    sql(c,"delete from user_roles where user_id=?",ACTOR);
    System.out.println("CLEANUP: setup identity disabled, unlicensed, roles removed and token revoked. Existing staff registrations unchanged.");
   }
  }
 }
}
