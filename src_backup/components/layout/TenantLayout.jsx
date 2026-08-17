import { Outlet } from "react-router-dom";
import TenantSidebar from "./TenantSidebar";
import TenantTopBar from "../navigation/TenantTopBar";

export default function TenantLayout() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "292px 1fr",
        minHeight: "100vh",
        background: "#eef3f7",
      }}
    >
      <TenantSidebar />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        <TenantTopBar />

        <main
          style={{
            flex: 1,
            padding: "32px",
            overflowY: "auto",
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}