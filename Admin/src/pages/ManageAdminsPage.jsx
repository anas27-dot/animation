import { useState, useEffect } from "react";
import api from "../services/api";
import { toast } from "react-toastify";
import { Eye, EyeOff, UserPlus, Trash2, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import EditAdminModal from "../components/EditAdminModal";

const ManageAdminsPage = () => {
  // State for the form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // State for the page
  const [adminList, setAdminList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);

  // MODIFIED: Get the token directly from the auth context
  const { user: loggedInUser, token } = useAuth();

  const fetchAdmins = async () => {
    // No need for a try-catch here if the parent component handles loading/error states
    // based on the presence of adminList.
    try {
      const response = await api.get("/admin/all", {
        headers: { Authorization: `Bearer ${token}` }, // Use token from context
      });

      console.log("API Response on Frontend:", response.data);

      // Ensure we always set an array, even if the API response doesn't have admins property
      const admins = response.data?.data?.admins || response.data?.admins || response.data;
      setAdminList(Array.isArray(admins) ? admins : []);
    } catch (err) {
      console.error("Error fetching admins:", err);
      toast.error(err.response?.data?.message || "Could not fetch admins.");
      // Set empty array on error to prevent undefined issues
      setAdminList([]);
    }
  };

  useEffect(() => {
    // Only fetch if we have a token
    if (token) {
      fetchAdmins();
    }
  }, [token]); // Re-run if the token changes

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api.post(
        "/admin/create",
        { name, email, password, isSuperAdmin },
        { headers: { Authorization: `Bearer ${token}` } } // Use token from context
      );
      toast.success("Admin created successfully.");
      // Reset form
      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setIsSuperAdmin(false);
      fetchAdmins(); // Refresh the list
    } catch (error) {
      toast.error(error?.response?.data?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, adminId) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this admin?")) return;
    try {
      await api.delete(`/admin/delete/${adminId}`, {
        headers: { Authorization: `Bearer ${token}` }, // Use token from context
      });
      toast.success("Admin deleted successfully.");
      fetchAdmins();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete admin.");
    }
  };

  const handleToggleSuperAdmin = async (e, adminId) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to change this admin's role?"))
      return;
    try {
      await api.put(
        `/admin/toggle-role/${adminId}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }, // Use token from context
        }
      );
      toast.success("Admin role updated.");
      fetchAdmins();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update role.");
    }
  };

  return (
    <>
      <div className="p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-8 text-[#1e3a8a]">Manage Admins</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Card */}
          <div className="lg:col-span-1">
            <div className="w-full bg-white rounded-xl shadow-lg p-8 border border-gray-200">
              <h2 className="text-2xl font-bold text-center mb-6 flex items-center justify-center gap-2 text-[#1e3a8a]">
                <UserPlus size={24} /> Add New Admin
              </h2>
              <form onSubmit={handleCreateSubmit} className="space-y-5">
                <input
                  type="text"
                  placeholder="Admin Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#1e3a8a] shadow-sm"
                  required
                />
                <input
                  type="email"
                  placeholder="Admin Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#1e3a8a] shadow-sm"
                  required
                />
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full p-3 rounded-lg border border-gray-300 pr-10 focus:ring-2 focus:ring-[#1e3a8a] shadow-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 inset-y-0 text-gray-500"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm Password"
                    className="w-full p-3 rounded-lg border border-gray-300 pr-10 focus:ring-2 focus:ring-[#1e3a8a] shadow-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((p) => !p)}
                    className="absolute right-3 inset-y-0 text-gray-500"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="isSuperAdmin"
                    checked={isSuperAdmin}
                    onChange={(e) => setIsSuperAdmin(e.target.checked)}
                    className="h-5 w-5 rounded text-[#1e3a8a] focus:ring-[#1e3a8a]"
                  />
                  <label
                    htmlFor="isSuperAdmin"
                    className="font-medium text-gray-700"
                  >
                    Make Super Admin
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full bg-[#1e3a8a] hover:bg-[#1e40af] text-white py-2.5 rounded-lg font-semibold transition-all shadow-md ${
                    loading ? "opacity-60" : "hover:shadow-lg"
                  }`}
                >
                  {loading ? "Adding..." : "Add Admin"}
                </button>
              </form>
            </div>
          </div>

          {/* Admin List */}
          <div className="lg:col-span-2">
            <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-lg">
              <table className="min-w-full text-sm text-gray-700">
                <thead className="bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] text-white text-left uppercase tracking-wider">
                  <tr>
                    <th className="p-4 font-semibold">Name</th>
                    <th className="p-4 font-semibold">Email</th>
                    <th className="p-4 font-semibold">Role</th>
                    <th className="p-4 font-semibold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Array.isArray(adminList) ? adminList.map((admin) => (
                    <tr
                      key={admin._id}
                      onClick={() => setEditingAdmin(admin)}
                      className="hover:bg-gray-100 cursor-pointer"
                    >
                      <td className="p-4 font-medium">{admin.name}</td>
                      <td className="p-4">{admin.email}</td>
                      <td className="p-4">
                        {admin.isSuperAdmin ? (
                          <span className="px-2 py-1 font-semibold leading-tight text-red-700 bg-red-100 rounded-full">
                            Super Admin
                          </span>
                        ) : (
                          <span className="px-2 py-1 font-semibold leading-tight text-gray-700 bg-gray-100 rounded-full">
                            Admin
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) =>
                              handleToggleSuperAdmin(e, admin._id)
                            }
                            disabled={admin._id === loggedInUser?.id}
                            className="p-2 text-gray-500 rounded-full hover:bg-yellow-100 hover:text-yellow-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Promote/Demote"
                          >
                            <ShieldCheck size={18} />
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, admin._id)}
                            disabled={admin._id === loggedInUser?.id}
                            className="p-2 text-gray-500 rounded-full hover:bg-red-100 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Delete Admin"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="4" className="p-4 text-center text-gray-500">
                        No admins found or data is loading...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Render the modal conditionally */}
      {editingAdmin && (
        <EditAdminModal
          admin={editingAdmin}
          onClose={() => setEditingAdmin(null)}
          refresh={fetchAdmins}
        />
      )}
    </>
  );
};

export default ManageAdminsPage;
