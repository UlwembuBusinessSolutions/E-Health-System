import { useEffect, useMemo, useState } from "react";
import { FiClock, FiUserCheck } from "react-icons/fi";
import { getQueue } from "../../../services/receptionService";
import "../../../styles/tenant-queue-board.css";

export default function QueueBoard() {
  const [queue, setQueue] = useState([]);
  const [currentTime, setCurrentTime] = useState(
    new Date()
  );

  useEffect(() => {
    const loadQueue = () => {
      setQueue(getQueue());
    };

    loadQueue();

    const queueInterval = setInterval(
      loadQueue,
      1000
    );

    const clockInterval = setInterval(
      () => {
        setCurrentTime(new Date());
      },
      1000
    );

    return () => {
      clearInterval(queueInterval);
      clearInterval(clockInterval);
    };
  }, []);

  const nowServing = useMemo(() => {
    return queue.find(
      (item) => item.status === "In Consultation"
    );
  }, [queue]);

  const waitingPatients = useMemo(() => {
    return queue.filter(
      (item) => item.status === "Waiting"
    );
  }, [queue]);

  const formatTime = (date) => {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPatientName = (item) => {
    return `${item.patient?.firstName || ""} ${
      item.patient?.surname || ""
    }`.trim();
  };

  const getWaitingMinutes = (checkInTime) => {
    if (!checkInTime) {
      return 0;
    }

    const difference =
      Date.now() -
      new Date(checkInTime).getTime();

    return Math.max(
      0,
      Math.floor(difference / 60000)
    );
  };

  return (
    <div className="queue-board-page">

      {/* HEADER */}

      <header className="queue-board-header">

        <div>
          <div className="queue-board-eyebrow">
            MAMELODI HEALTH SERVICES
          </div>

          <h1>
            Waiting Room Queue Board
          </h1>

          <p>
            Please wait for your token number to
            be called. Thank you for choosing
            Ulwembu Healthcare.
          </p>
        </div>

        <div className="queue-board-clock">

          <span>
            <FiClock />
            CURRENT TIME
          </span>

          <strong>
            {formatTime(currentTime)}
          </strong>

        </div>

      </header>

      <div className="queue-board-divider" />

      {/* MAIN BOARD */}

      <div className="queue-board-content">

        {/* NOW SERVING */}

        <section className="queue-board-panel">

          <div className="queue-board-panel-header">

            <div className="queue-board-panel-icon">
              <FiUserCheck />
            </div>

            <h2>
              Now Serving
            </h2>

          </div>

          {nowServing ? (

            <div className="queue-now-serving">

              <div className="queue-token-header">

                <span>
                  TOKEN NUMBER
                </span>

                <strong>
                  {nowServing.tokenNumber ||
                    nowServing.id}
                </strong>

              </div>

              <div className="queue-token-number">
                {nowServing.tokenNumber ||
                  "A001"}
              </div>

              <h3>
                {getPatientName(nowServing)}
              </h3>

              <div className="queue-room">
                Room{" "}
                {nowServing.room || "2"}
              </div>

            </div>

          ) : (

            <div className="queue-empty-serving">

              <FiUserCheck />

              <strong>
                No patient currently being served
              </strong>

              <span>
                Please wait for the next patient
              </span>

            </div>

          )}

        </section>

        {/* WAITING QUEUE */}

        <section className="queue-board-panel">

          <div className="queue-board-panel-header">

            <div className="queue-board-panel-icon">
              <FiClock />
            </div>

            <h2>
              Waiting Queue
            </h2>

          </div>

          <div className="queue-waiting-list">

            {waitingPatients.length === 0 ? (

              <div className="queue-empty-waiting">

                <FiClock />

                <strong>
                  No patients waiting
                </strong>

                <span>
                  The waiting queue is currently
                  empty.
                </span>

              </div>

            ) : (

              waitingPatients.map(
                (item, index) => (

                  <div
                    className={`queue-waiting-item ${
                      item.priority === "Urgent"
                        ? "urgent"
                        : ""
                    }`}
                    key={item.id}
                  >

                    <div className="queue-waiting-token">

                      {item.tokenNumber ||
                        `A${String(
                          index + 3
                        ).padStart(3, "0")}`}

                    </div>

                    <div className="queue-waiting-patient">

                      <strong>
                        {getPatientName(item)}
                      </strong>

                      <span>
                        Estimated wait:{" "}
                        {getWaitingMinutes(
                          item.checkInTime
                        )}{" "}
                        min
                      </span>

                    </div>

                    <div className="queue-waiting-position">
                      #{index + 1}
                    </div>

                  </div>

                )
              )

            )}

          </div>

        </section>

      </div>

    </div>
  );
}