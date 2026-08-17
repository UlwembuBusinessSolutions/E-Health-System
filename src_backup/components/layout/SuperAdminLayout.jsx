import { Outlet } from "react-router-dom";
import SuperAdminSidebar from "./SuperAdminSidebar";

export default function SuperAdminLayout() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "292px 1fr",
        minHeight: "100vh",
        background: "#eef3f7",
      }}
    >
      <SuperAdminSidebar />

      <main
        style={{
          padding: "32px",
          overflowY: "auto",
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
