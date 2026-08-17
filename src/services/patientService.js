const STORAGE_KEY = "ulwembu_patients";

const defaultPatients = [
  {
    id: "MPI-000001",
    firstName: "Thabo",
    surname: "Mokoena",
    idNumber: "8501015800081",
    dateOfBirth: "1985-01-01",
    gender: "Male",
    phone: "082 555 0142",
    medicalAid: "Discovery Health",
    medicalAidNumber: "DHC458921",
    status: "Active",
    registeredDate: "2026-08-16",
  },
  {
    id: "MPI-000002",
    firstName: "Lerato",
    surname: "Mahlangu",
    idNumber: "9206140800087",
    dateOfBirth: "1992-06-14",
    gender: "Female",
    phone: "083 444 2198",
    medicalAid: "GEMS",
    medicalAidNumber: "GMS784521",
    status: "Active",
    registeredDate: "2026-08-16",
  },
];

export function getPatients() {
  const storedPatients = localStorage.getItem(STORAGE_KEY);

  if (!storedPatients) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(defaultPatients)
    );

    return defaultPatients;
  }

  try {
    return JSON.parse(storedPatients);
  } catch {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(defaultPatients)
    );

    return defaultPatients;
  }
}

export function savePatients(patients) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(patients)
  );
}

export function createPatient(patientData) {
  const patients = getPatients();

  const patient = {
    ...patientData,
    id: generateMPI(patients),
    status: "Active",
    registeredDate: new Date()
      .toISOString()
      .split("T")[0],
  };

  const updatedPatients = [
    ...patients,
    patient,
  ];

  savePatients(updatedPatients);

  return patient;
}

export function getPatientById(patientId) {
  const patients = getPatients();

  return patients.find(
    (patient) => patient.id === patientId
  );
}

export function updatePatient(patientId, updates) {
  const patients = getPatients();

  const updatedPatients = patients.map((patient) =>
    patient.id === patientId
      ? {
          ...patient,
          ...updates,
        }
      : patient
  );

  savePatients(updatedPatients);

  return updatedPatients.find(
    (patient) => patient.id === patientId
  );
}

export function deletePatient(patientId) {
  const patients = getPatients();

  const updatedPatients = patients.filter(
    (patient) => patient.id !== patientId
  );

  savePatients(updatedPatients);
}

function generateMPI(patients) {
  const numbers = patients
    .map((patient) => {
      const match = patient.id?.match(/MPI-(\d+)/);

      return match
        ? Number(match[1])
        : 0;
    })
    .filter(Boolean);

  const nextNumber =
    numbers.length > 0
      ? Math.max(...numbers) + 1
      : 1;

  return `MPI-${String(nextNumber).padStart(6, "0")}`;
}