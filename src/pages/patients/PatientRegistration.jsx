import { useState } from "react"
import { useNavigate } from "react-router-dom"

export default function PatientRegistration() {
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    idNumber: "",
    phone: "",
    gender: "",
    address: "",
  })

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    // Get existing patients
    const existing = JSON.parse(localStorage.getItem("patients") || "[]")

    // Create new patient
    const newPatient = {
      id: `P-${Date.now()}`,
      ...formData,
      createdAt: new Date().toLocaleDateString(),
    }

    // Save to localStorage
    localStorage.setItem("patients", JSON.stringify([...existing, newPatient]))

    alert("Patient registered successfully!")

    // Redirect to patients page
    navigate("/patients")
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Patient Registration
        </h1>
        <p className="text-slate-600 mt-1">
          Register a new patient for Mamelodi Health Services
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              First Name
            </label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Last Name
            </label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              ID Number
            </label>
            <input
              type="text"
              name="idNumber"
              value={formData.idNumber}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Gender
            </label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none"
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Address
          </label>
          <textarea
            name="address"
            value={formData.address}
            onChange={handleChange}
            rows={3}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => navigate("/patients")}
            className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium"
          >
            Cancel
          </button>

          <button
            type="submit"
            className="px-5 py-3 rounded-xl bg-teal-700 text-white hover:bg-teal-800 font-medium shadow-sm"
          >
            Save Patient
          </button>
        </div>
      </form>
    </div>
  )
}