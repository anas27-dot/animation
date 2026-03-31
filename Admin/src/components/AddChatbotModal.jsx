// src/components/AddChatbotModal.jsx
import { useState } from "react";

const AddChatbotModal = ({ company, onClose, onCreate }) => {
  const [name, setName] = useState(`${company.name} Bot`);
  const [initialCredits, setInitialCredits] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    // Validate initial credits is provided and valid
    if (!initialCredits.trim()) {
      alert("Initial Credits is required");
      return;
    }
    
    const credits = parseInt(initialCredits, 10);
    if (isNaN(credits) || credits < 0) {
      alert("Please enter a valid credit amount (0 or greater)");
      return;
    }
    
    onCreate(company._id, name, credits);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl w-[90%] max-w-md shadow-2xl border border-gray-200">
        <h2 className="text-lg font-bold mb-4 text-[#1e3a8a]">Create Chatbot for {company.name}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Chatbot Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Initial Credits <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={initialCredits}
              onChange={(e) => setInitialCredits(e.target.value)}
              placeholder="Enter credits"
              min="0"
              required
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
            />
          </div>

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#1e3a8a] text-white hover:bg-[#1e40af] text-sm shadow-md transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddChatbotModal;
