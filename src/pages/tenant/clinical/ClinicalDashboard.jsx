import { useNavigate } from "react-router-dom";
import {
  FiActivity,
  FiUsers,
  FiClipboard,
  FiFileText,
  FiArrowRight,
  FiClock,
  FiAlertCircle,
  FiCheckCircle,
} from "react-icons/fi";

import "../../../styles/tenant-clinical-dashboard.css";

export default function ClinicalDashboard() {
  const navigate = useNavigate();

  const clinicalModules = [
    {
      title: "Clinical Services",
      description:
        "Access and manage the clinical services provided by the organisation.",
      icon: <FiActivity />,
      path: "/tenant/clinical/services",
    },
    {
      title: "Consultations",
      description:
        "View and manage patient consultations and clinical encounters.",
      icon: <FiClipboard />,
      path: "/tenant/clinical/consultations",
    },
    {
      title: "Diagnosis",
      description:
        "Record and manage patient diagnoses during clinical encounters.",
      icon: <FiFileText />,
      path: "/tenant/clinical/diagnosis",
    },
    {
      title: "Laboratory",
      description:
        "Create and track laboratory requests and patient investigations.",
      icon: <FiActivity />,
      path: "/tenant/clinical/laboratory",
    },
    {
      title: "Patient Search",
      description:
        "Quickly locate patient records for clinical care.",
      icon: <FiUsers />,
      path: "/tenant/clinical/patient-search",
    },
    {
      title: "Prescriptions",
      description:
        "Create and manage prescriptions for patients.",
      icon: <FiFileText />,
      path: "/tenant/clinical/prescriptions",
    },
    {
      title: "Referrals",
      description:
        "Manage referrals to specialists and other healthcare services.",
      icon: <FiArrowRight />,
      path: "/tenant/clinical/referrals",
    },
    {
      title: "Vitals",
      description:
        "Capture and review patient vital signs.",
      icon: <FiActivity />,
      path: "/tenant/clinical/vitals",
    },
  ];

  return (
    <div className="clinical-dashboard-page">

      {/* PAGE HEADER */}

      <div className="clinical-dashboard-header">

        <div>
          <div className="clinical-page-eyebrow">
            CLINICAL SERVICES
          </div>

          <h1>Clinical Dashboard</h1>

          <p>
            Manage clinical activities, patient consultations,
            diagnoses and healthcare services.
          </p>
        </div>

        <div className="clinical-header-icon">
          <FiActivity />
        </div>

      </div>


      {/* SUMMARY CARDS */}

      <div className="clinical-stat-grid">

        <div className="clinical-stat-card">

          <div className="clinical-stat-icon">
            <FiUsers />
          </div>

          <div>
            <span>Patients Today</span>
            <strong>24</strong>
            <small>Clinical patients</small>
          </div>

        </div>


        <div className="clinical-stat-card">

          <div className="clinical-stat-icon">
            <FiClipboard />
          </div>

          <div>
            <span>Consultations</span>
            <strong>18</strong>
            <small>Today's consultations</small>
          </div>

        </div>


        <div className="clinical-stat-card">

          <div className="clinical-stat-icon warning">
            <FiClock />
          </div>

          <div>
            <span>Waiting</span>
            <strong>6</strong>
            <small>Patients awaiting care</small>
          </div>

        </div>


        <div className="clinical-stat-card">

          <div className="clinical-stat-icon success">
            <FiCheckCircle />
          </div>

          <div>
            <span>Completed</span>
            <strong>12</strong>
            <small>Completed consultations</small>
          </div>

        </div>

      </div>


      {/* QUICK ACTIONS */}

      <section className="clinical-section">

        <div className="clinical-section-header">

          <div>
            <h2>Clinical Modules</h2>

            <p>
              Select a clinical module to continue.
            </p>
          </div>

        </div>


        <div className="clinical-module-grid">

          {clinicalModules.map((module) => (

            <button
              type="button"
              key={module.title}
              className="clinical-module-card"
              onClick={() => navigate(module.path)}
            >

              <div className="clinical-module-icon">
                {module.icon}
              </div>

              <div className="clinical-module-content">

                <h3>{module.title}</h3>

                <p>
                  {module.description}
                </p>

              </div>

              <div className="clinical-module-arrow">
                <FiArrowRight />
              </div>

            </button>

          ))}

        </div>

      </section>


      {/* CLINICAL ACTIVITY */}

      <section className="clinical-section">

        <div className="clinical-section-header">

          <div>
            <h2>Clinical Activity</h2>

            <p>
              Recent activity within the clinical department.
            </p>
          </div>

        </div>


        <div className="clinical-activity-card">

          <div className="clinical-activity-item">

            <div className="clinical-activity-icon">
              <FiUsers />
            </div>

            <div>
              <strong>
                Patient consultation started
              </strong>

              <span>
                Patient consultation is currently in progress.
              </span>
            </div>

            <small>
              10 min ago
            </small>

          </div>


          <div className="clinical-activity-item">

            <div className="clinical-activity-icon">
              <FiFileText />
            </div>

            <div>
              <strong>
                Laboratory request created
              </strong>

              <span>
                A new laboratory investigation was requested.
              </span>
            </div>

            <small>
              25 min ago
            </small>

          </div>


          <div className="clinical-activity-item">

            <div className="clinical-activity-icon">
              <FiCheckCircle />
            </div>

            <div>
              <strong>
                Consultation completed
              </strong>

              <span>
                Clinical consultation was successfully completed.
              </span>
            </div>

            <small>
              42 min ago
            </small>

          </div>


          <div className="clinical-activity-item">

            <div className="clinical-activity-icon warning">
              <FiAlertCircle />
            </div>

            <div>
              <strong>
                Patient waiting
              </strong>

              <span>
                Patients are currently waiting for clinical attention.
              </span>
            </div>

            <small>
              Active
            </small>

          </div>

        </div>

      </section>

    </div>
  );
}