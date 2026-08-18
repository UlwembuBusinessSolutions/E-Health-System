const STORAGE_KEY = "ulwembu_reception_queue";

function getToday() {
  return new Date().toISOString().split("T")[0];
}

/*
==========================================================
GET QUEUE
==========================================================
*/

export function getQueue() {
  const storedQueue =
    localStorage.getItem(STORAGE_KEY);

  if (!storedQueue) {
    return [];
  }

  try {
    return JSON.parse(storedQueue);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

/*
==========================================================
SAVE QUEUE
==========================================================
*/

export function saveQueue(queue) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(queue)
  );
}

/*
==========================================================
GENERATE TOKEN
==========================================================
*/

export function generateToken(queue) {
  const today = getToday();

  const todaysQueue = queue.filter(
    (item) => item.queueDate === today
  );

  const numbers = todaysQueue
    .map((item) => {
      const match =
        item.tokenNumber?.match(/A(\d+)/);

      return match
        ? Number(match[1])
        : 0;
    })
    .filter(Boolean);

  const nextNumber =
    numbers.length > 0
      ? Math.max(...numbers) + 1
      : 1;

  return `A${String(nextNumber).padStart(3, "0")}`;
}

/*
==========================================================
ADD PATIENT TO QUEUE
==========================================================
*/

export function addToQueue(patient) {
  if (!patient) {
    return null;
  }

  const queue = getQueue();

  /*
  Prevent the same patient from being
  checked in twice while already active.
  */

  const existingPatient = queue.find(
    (item) =>
      item.patientId === patient.id &&
      item.queueDate === getToday() &&
      (
        item.status === "Waiting" ||
        item.status === "Called" ||
        item.status === "In Consultation"
      )
  );

  if (existingPatient) {
    return existingPatient;
  }

  const now = new Date().toISOString();

  const queueItem = {
    id: `QUEUE-${Date.now()}`,

    tokenNumber: generateToken(queue),

    patientId: patient.id,

    patient,

    queueDate: getToday(),

    status: "Waiting",

    priority: "Normal",

    room: null,

    checkInTime: now,

    calledAt: null,

    consultationStartedAt: null,

    completedAt: null,
  };

  const updatedQueue = [
    ...queue,
    queueItem,
  ];

  saveQueue(updatedQueue);

  return queueItem;
}

/*
==========================================================
GET TODAY'S QUEUE
==========================================================
*/

export function getTodaysQueue() {
  const queue = getQueue();

  return queue
    .filter(
      (item) =>
        item.queueDate === getToday()
    )
    .sort((a, b) => {
      return (
        new Date(a.checkInTime) -
        new Date(b.checkInTime)
      );
    });
}

/*
==========================================================
GET WAITING PATIENTS
==========================================================
*/

export function getWaitingPatients() {
  return getTodaysQueue().filter(
    (item) =>
      item.status === "Waiting"
  );
}

/*
==========================================================
GET CURRENTLY SERVING
==========================================================
*/

export function getNowServing() {
  return getTodaysQueue().find(
    (item) =>
      item.status === "In Consultation"
  );
}

/*
==========================================================
CALL PATIENT
==========================================================
*/

export function callPatient(
  queueId,
  room = "2"
) {
  const queue =
    getQueue();

  const now =
    new Date().toISOString();

  /*
  First remove any patient currently
  being served.
  */

  const updatedQueue =
    queue.map((item) => {

      if (
        item.status ===
        "In Consultation"
      ) {
        return {
          ...item,
          status: "Waiting",
          room: null,
        };
      }

      if (
        item.id === queueId
      ) {
        return {
          ...item,
          status:
            "In Consultation",

          room,

          calledAt: now,

          consultationStartedAt:
            now,
        };
      }

      return item;
    });

  saveQueue(updatedQueue);

  return updatedQueue.find(
    (item) =>
      item.id === queueId
  );
}

/*
==========================================================
START CONSULTATION
==========================================================
*/

export function startConsultation(
  queueId,
  room = "2"
) {
  return callPatient(
    queueId,
    room
  );
}

/*
==========================================================
COMPLETE QUEUE ITEM
==========================================================
*/

export function completeQueueItem(
  queueId
) {
  const queue =
    getQueue();

  const updatedQueue =
    queue.map((item) =>
      item.id === queueId
        ? {
            ...item,
            status:
              "Completed",
            completedAt:
              new Date().toISOString(),
          }
        : item
    );

  saveQueue(updatedQueue);

  return updatedQueue.find(
    (item) =>
      item.id === queueId
  );
}

/*
==========================================================
CANCEL QUEUE ITEM
==========================================================
*/

export function cancelQueueItem(
  queueId
) {
  const queue =
    getQueue();

  const updatedQueue =
    queue.map((item) =>
      item.id === queueId
        ? {
            ...item,
            status:
              "Cancelled",
          }
        : item
    );

  saveQueue(updatedQueue);
}

/*
==========================================================
CHANGE PRIORITY
==========================================================
*/

export function setQueuePriority(
  queueId,
  priority
) {
  const queue =
    getQueue();

  const updatedQueue =
    queue.map((item) =>
      item.id === queueId
        ? {
            ...item,
            priority,
          }
        : item
    );

  saveQueue(updatedQueue);

  return updatedQueue.find(
    (item) =>
      item.id === queueId
  );
}

/*
==========================================================
REMOVE QUEUE ITEM
==========================================================
*/

export function removeFromQueue(
  queueId
) {
  const queue =
    getQueue();

  const updatedQueue =
    queue.filter(
      (item) =>
        item.id !== queueId
    );

  saveQueue(updatedQueue);
}