import java.net.URI;
import java.net.http.*;
import java.sql.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import com.fasterxml.jackson.databind.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

// Standalone live HTTP harness. Only creates and deletes its own UUID-tagged fixture rows.
class LivePartialDispensingCheck {
 static final HttpClient http=HttpClient.newHttpClient();
 static final ObjectMapper json=new ObjectMapper();
 static final String base=System.getenv().getOrDefault("LIVE_API_BASE","http://localhost:8082");
 static final UUID actor=UUID.randomUUID(), facility=UUID.randomUUID(), otherFacility=UUID.randomUUID(),
  patient=UUID.randomUUID(), visit=UUID.randomUUID(), product=UUID.randomUUID(), otherLocation=UUID.randomUUID();
 static final String tag=actor.toString().substring(0,8), email="pharmacy-test-"+actor+"@example.invalid", password=UUID.randomUUID()+"Aa1!";
 static UUID batch,location; static String token; static int checks;
 static void check(boolean ok,String name){if(!ok)throw new AssertionError(name);checks++;System.out.println("PASS: "+name);}
 static HttpRequest request(String method,String path,Object body,boolean authenticated)throws Exception{
  var b=HttpRequest.newBuilder(URI.create(base+path)).timeout(Duration.ofSeconds(120))
   .header("X-Tenant-ID","demo-clinic").header("User-Agent","PHRM-US-006-live-check");
  if(authenticated && token!=null)b.header("Authorization","Bearer "+token);
  if(body!=null)b.header("Content-Type","application/json");
  return b.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build();
 }
 static HttpResponse<String> call(String method,String path,Object body)throws Exception{
  return http.send(request(method,path,body,true),HttpResponse.BodyHandlers.ofString());
 }
 static void code(HttpResponse<String> response,int expected,String name){
  check(response.statusCode()==expected,name+" HTTP "+expected+(response.statusCode()==expected?"":"; received "+response.statusCode()+" "+response.body()));
 }
 static void sql(Connection c,String query,Object...params)throws Exception{
  try(var s=c.prepareStatement(query)){for(int i=0;i<params.length;i++)s.setObject(i+1,params[i]);s.executeUpdate();}
 }
 static long number(Connection c,String query,Object...params)throws Exception{
  try(var s=c.prepareStatement(query)){for(int i=0;i<params.length;i++)s.setObject(i+1,params[i]);try(var rs=s.executeQuery()){rs.next();return rs.getLong(1);}}
 }
 static UUID uuid(Connection c,String query,Object...params)throws Exception{
  try(var s=c.prepareStatement(query)){for(int i=0;i<params.length;i++)s.setObject(i+1,params[i]);try(var rs=s.executeQuery()){if(!rs.next())throw new AssertionError("Missing fixture row");return rs.getObject(1,UUID.class);}}
 }
 record Line(UUID prescription,UUID item) {String path(){return "/api/v1/prescriptions/"+prescription+"/items/"+item+"/dispense";}}
 static Line line(Connection c,int quantity)throws Exception{
  UUID rx=UUID.randomUUID(),item=UUID.randomUUID();
  sql(c,"insert into prescriptions(id,serial_number,visit_id,patient_id,facility_id,prescriber_id) values(?,?,?,?,?,?)",rx,"T-"+rx.toString().substring(0,18),visit,patient,facility,actor);
  sql(c,"insert into prescription_items(id,prescription_id,drug_name,dosage,quantity,product_id,clinical_check_status) values(?,?,'Live test tablet','Test only',?,?,'PASSED')",item,rx,quantity,product);
  return new Line(rx,item);
 }
 static Map<String,Object> stock(int quantity){return Map.of("productId",product,"batchId",batch,"locationId",location,"quantity",quantity);}
 static long balance(Connection c)throws Exception{return number(c,"select quantity from pharmacy_stock_accounts where product_id=? and location_id=? and bucket='AVAILABLE'",product,location);}
 static List<Integer> race(Line a,int qa,Line b,int qb)throws Exception{
  var fa=http.sendAsync(request("POST",a.path(),stock(qa),true),HttpResponse.BodyHandlers.ofString());
  var fb=http.sendAsync(request("POST",b.path(),stock(qb),true),HttpResponse.BodyHandlers.ofString());
  return java.util.stream.Stream.of(fa.get(40,TimeUnit.SECONDS).statusCode(),fb.get(40,TimeUnit.SECONDS).statusCode()).sorted().toList();
 }
 public static void main(String[]args)throws Exception{
  try(var c=DriverManager.getConnection(System.getenv("LIVE_DB_URL"),System.getenv().getOrDefault("LIVE_DB_USER","postgres"),System.getenv("LIVE_DB_PASSWORD"))){
   sql(c,"set search_path to demo_clinic");
   try{
    sql(c,"insert into facilities(id,name,code,type) values(?,'PHRM live test',?,'CLINIC'),(?,'PHRM other clinic',?,'CLINIC')",facility,"PT-"+tag,otherFacility,"PO-"+tag);
    sql(c,"insert into users(id,employee_number,email,first_name,last_name,contact_number,password_hash,facility_id,sapc_number,sapc_expiry_date) values(?,?,?,'Live','Pharmacist',?,?,?, ?,CURRENT_DATE+365)",actor,"PT-"+tag,email,"+279"+System.currentTimeMillis()%1000000000,new BCryptPasswordEncoder(12).encode(password),facility,"TEST-"+tag);
    sql(c,"insert into user_roles(user_id,role_id) select ?,id from roles where name='ORG_ADMIN'",actor);
    sql(c,"insert into patients(id,mpi_number,first_name,last_name,date_of_birth,gender,citizenship_status,id_number,address,contact_number) values(?,?,'Synthetic','Pharmacy Test','1990-01-01','MALE','SA_CITIZEN',?,'Test fixture','+27000000000')",patient,"PT-"+tag,"9"+String.format("%012d",System.currentTimeMillis()%1000000000000L));
    sql(c,"insert into visits(id,patient_id,facility_id,visit_type,service_stream,visit_datetime,created_by_user_id) values(?,?,?,'NEW','PHARMACY',now(),?)",visit,patient,facility,actor);
    sql(c,"insert into pharmacy_products(id,code,display_name,category,base_unit,pack_size,batch_tracked,expiry_tracked,created_by,created_by_name,created_at) values(?,?,'Synthetic 30-tablet pack','MEDICINE','TABLET',30,true,true,?,'Live Pharmacist',now())",product,"PT-"+tag,actor);
    sql(c,"insert into pharmacy_facility_products(product_id,facility_id,created_at) values(?,?,now())",product,facility);
    sql(c,"insert into pharmacy_stock_locations(id,facility_id,code,name,created_at) values(?,?,'TEST','Other clinic',now())",otherLocation,otherFacility);
    var login=call("POST","/api/v1/auth/login",Map.of("email",email,"password",password));code(login,200,"Temporary pharmacist login");token=json.readTree(login.body()).get("accessToken").asText();
    var received=call("POST","/api/v1/pharmacy/receipts",Map.of("facilityId",facility,"sourceReference","PHRM-US-006-"+tag,"lines",List.of(Map.of("productId",product,"manufacturer","Test","lotNumber",tag,"expiryDate","2030-12-31","expiryPrecision","DAY","baseQuantity",100))));
    code(received,201,"Receive 100 base units");
    batch=uuid(c,"select id from pharmacy_batches where product_id=?",product);location=uuid(c,"select id from pharmacy_stock_locations where facility_id=? and code='MAIN'",facility);
    var first=line(c,30);
    sql(c,"update prescription_items set clinical_check_status='REVIEW_REQUIRED', clinical_check_note='Interaction check required' where id=?",first.item());
    code(call("POST",first.path(),stock(7)),400,"API blocks clinically uncleared dispensing");
    code(call("POST","/api/v1/prescriptions/"+first.prescription()+"/items/"+first.item()+"/review",Map.of("productId",product,"status","PASSED","note","Medicine, dose and interactions checked for synthetic test")),204,"Record clinical review");
    var positions=call("GET","/api/v1/pharmacy/stock/positions?facilityId="+facility,null);
    code(positions,200,"Read clinic-scoped stock positions");
    var position=json.readTree(positions.body()).get("items").get(0);
    check(position.get("locationId").asText().equals(location.toString()) && position.get("batchId").asText().equals(batch.toString()) && position.get("available").asInt()==100,"Stock response supplies exact batch and location for frontend");
    code(http.send(request("POST",first.path(),stock(7),false),HttpResponse.BodyHandlers.ofString()),403,"Unauthenticated dispense rejected");
    for(int q:new int[]{0,-1,31})code(call("POST",first.path(),stock(q)),400,"Reject quantity "+q);
    code(call("POST",first.path(),null),400,"Reject missing body");
    var wrong=new HashMap<String,Object>(stock(7));wrong.put("locationId",otherLocation);code(call("POST",first.path(),wrong),400,"Reject another clinic's stock");
    sql(c,"update pharmacy_batches set expiry_date=CURRENT_DATE-1 where id=?",batch);
    code(call("POST",first.path(),stock(7)),400,"Reject expired batch");
    sql(c,"update pharmacy_batches set expiry_date='2030-12-31' where id=?",batch);
    check(balance(c)==100,"Rejected requests preserve stock");
    code(call("POST",first.path(),stock(7)),204,"Dispense 7 from a 30-tablet pack");check(balance(c)==93,"Exact stock deduction leaves 93");
    var rx=call("GET","/api/v1/prescriptions/"+first.prescription(),null);code(rx,200,"Read partial prescription");
    var data=json.readTree(rx.body());check(data.get("status").asText().equals("PARTIALLY_DISPENSED"),"Prescription stays partially dispensed");
    check(data.get("items").get(0).get("dispensedQuantity").asInt()==7,"Response exposes cumulative quantity 7");
    code(call("POST",first.path(),stock(23)),204,"Supply remaining 23");check(balance(c)==70,"Completed supply leaves stock 70");
    code(call("POST",first.path(),stock(1)),400,"Reject dispensing beyond completed quantity");
    var a=line(c,30);var b=line(c,30);check(race(a,11,b,13).equals(List.of(204,204)),"Concurrent different prescriptions both succeed");check(balance(c)==46,"Concurrent deductions lose no stock update");
    var same=line(c,10);check(race(same,7,same,7).equals(List.of(204,400)),"Concurrent same item cannot exceed prescribed quantity");check(balance(c)==39,"Only successful same-item dispense deducted");
    var overA=line(c,30);var overB=line(c,30);check(race(overA,30,overB,30).equals(List.of(204,409)),"Concurrent requests cannot overspend clinic stock");check(balance(c)==9,"Overspend loser preserves stock");
    var bulk=line(c,10);UUID second=UUID.randomUUID();sql(c,"insert into prescription_items(id,prescription_id,drug_name,dosage,quantity,product_id,clinical_check_status) values(?,?,'Synthetic tablet','Test only',10,?,'PASSED')",second,bulk.prescription(),product);
    String bulkPath="/api/v1/prescriptions/"+bulk.prescription()+"/dispense";
    code(call("POST",bulkPath,Map.of("items",List.of(Map.of("itemId",bulk.item(),"stock",stock(5)),Map.of("itemId",second,"stock",stock(5))))),409,"Insufficient second bulk line rolls back request");
    check(balance(c)==9,"Bulk rollback restores first stock deduction");check(number(c,"select sum(dispensed_quantity) from prescription_items where prescription_id=?",bulk.prescription())==0,"Bulk rollback restores prescription quantities");
    code(call("POST",bulkPath,Map.of("items",List.of(Map.of("itemId",bulk.item(),"stock",stock(2)),Map.of("itemId",second,"stock",stock(3))))),204,"Valid bulk dispense commits");check(balance(c)==4,"Bulk exact deductions leave stock 4");
    code(call("POST",bulkPath,Map.of("items",List.of(Map.of("itemId",bulk.item(),"stock",stock(1)),Map.of("itemId",bulk.item(),"stock",stock(1))))),400,"Reject duplicate bulk item");
    var ledger=call("GET","/api/v1/pharmacy/ledger?facilityId="+facility+"&productId="+product,null);code(ledger,200,"Read stock ledger");check(json.readTree(ledger.body()).get("totalItems").asLong()==9,"Ledger includes receipt and eight successful supplies only");
    check(number(c,"select sum(e.quantity_delta) from pharmacy_stock_entries e join pharmacy_stock_accounts a on a.id=e.stock_account_id where a.product_id=?",product)==4,"Ledger sum equals physical stock");
    check(number(c,"select count(*) from audit_log where user_id=? and action='PRESCRIPTION_ITEM_DISPENSED'",actor)==8,"Exactly eight committed dispense audits");
    check(number(c,"select count(*) from dispensing_records d join prescription_items i on i.id=d.prescription_item_id join prescriptions p on p.id=i.prescription_id where p.prescriber_id=?",actor)==7,"One latest supply summary per supplied item");
    sql(c,"update users set sapc_expiry_date=CURRENT_DATE-1 where id=?",actor);code(call("POST",bulk.path(),stock(1)),403,"Expired dispensing licence rejected");check(balance(c)==4,"Licence rejection preserves stock");
    if ("true".equals(System.getenv("LIVE_UI_HOLD"))) {
      sql(c,"update users set sapc_expiry_date=CURRENT_DATE+365 where id=?",actor);
      var ui=line(c,10);
      sql(c,"update prescription_items set clinical_check_status='REVIEW_REQUIRED', clinical_check_note='Interaction check required' where id=?",ui.item());
      java.nio.file.Files.writeString(java.nio.file.Path.of("target/pharmacy-ui-fixture.json"),json.writeValueAsString(Map.of("token",token,"facilityId",facility,"productId",product,"prescriptionId",ui.prescription(),"itemId",ui.item())));
      System.out.println("UI_FIXTURE_READY");
      int browserExit = 0;
      if ("true".equals(System.getenv("LIVE_UI_AUTORUN"))) browserExit = new ProcessBuilder("node", "docs/testing/pharmacy-live.cjs").inheritIO().start().waitFor();
      long deadline=System.nanoTime()+TimeUnit.MINUTES.toNanos(10);
      while(!java.nio.file.Files.exists(java.nio.file.Path.of("target/pharmacy-ui-done")) && System.nanoTime()<deadline) Thread.sleep(500);
      java.nio.file.Files.deleteIfExists(java.nio.file.Path.of("target/pharmacy-ui-fixture.json"));
      java.nio.file.Files.deleteIfExists(java.nio.file.Path.of("target/pharmacy-ui-done"));
      if ("true".equals(System.getenv("LIVE_UI_AUTORUN"))) check(browserExit == 0, "Real browser review and partial dispensing");
    }
    System.out.println("RESULT: "+checks+" live assertions passed.");
   } finally {
    c.setAutoCommit(false);
    try {
     sql(c,"delete from pharmacy_receipt_lines where receipt_id in(select id from pharmacy_receipts where created_by=?)",actor);
     sql(c,"delete from pharmacy_receipts where created_by=?",actor);
     sql(c,"delete from pharmacy_stock_entries where transaction_id in(select id from pharmacy_stock_transactions where actor_user_id=?)",actor);
     sql(c,"delete from pharmacy_stock_transactions where actor_user_id=?",actor);
     sql(c,"delete from pharmacy_stock_accounts where product_id=?",product);
     sql(c,"delete from pharmacy_batches where product_id=?",product);
     sql(c,"delete from pharmacy_facility_products where product_id=?",product);
     sql(c,"delete from pharmacy_stock_locations where facility_id in (?,?)",facility,otherFacility);
     sql(c,"delete from dispensing_records where prescription_item_id in(select i.id from prescription_items i join prescriptions p on p.id=i.prescription_id where p.prescriber_id=?)",actor);
     sql(c,"delete from prescription_items where prescription_id in(select id from prescriptions where prescriber_id=?)",actor);
     sql(c,"delete from prescriptions where prescriber_id=?",actor);
     sql(c,"delete from pharmacy_products where id=?",product);
     sql(c,"delete from visits where id=?",visit);sql(c,"delete from patients where id=?",patient);
     sql(c,"delete from audit_log where user_id=?",actor);sql(c,"delete from user_roles where user_id=?",actor);sql(c,"delete from users where id=?",actor);
     sql(c,"delete from facilities where id in (?,?)",facility,otherFacility);
     c.commit();System.out.println("CLEANUP: All temporary fixture rows removed.");
    } catch(Exception e){c.rollback();throw e;}
   }
  }
 }
}


