import { useEffect, useRef, useState } from "react";
import api, { getKnowledgeBaseFiles, deleteKnowledgeBaseFile } from "../services/api";
import { toast } from "react-toastify";
import { X, FileText } from "lucide-react";
// import axios from "axios";

const UploadContextModal = ({ chatbotId }) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState(null);
  const [showFilesModal, setShowFilesModal] = useState(false);

  const fetchFiles = async () => {
    if (!chatbotId) return;
    try {
      setLoadingFiles(true);
      const res = await getKnowledgeBaseFiles(chatbotId);
      const data = res.data?.files || res.data?.data?.files || [];
      setFiles(data);
    } catch (err) {
      console.error("Failed to fetch knowledge base files:", err);
      toast.error("Failed to load knowledge base files");
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatbotId]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("chatbotId", chatbotId);

    try {
      setUploading(true);

      const response = await api.post("/context/upload-file", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      

      toast.success(`✅ ${response.data.chunksStored} chunks stored.`);

      // Refresh file list after successful upload
      await fetchFiles();
    } catch (err) {
      console.error("Upload error:", err.response?.data || err.message);
      toast("❌ Failed to upload or process file.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (file) => {
    if (!window.confirm(`Delete knowledge base file "${file.filename}"? This will remove its embeddings as well.`)) {
      return;
    }
    try {
      setDeletingFileId(file._id);
      await deleteKnowledgeBaseFile(file._id, chatbotId);
      toast.success("File and related embeddings deleted");
      await fetchFiles();
    } catch (err) {
      console.error("Failed to delete file:", err);
      toast.error("Failed to delete knowledge base file");
    } finally {
      setDeletingFileId(null);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => fileInputRef.current.click()}
          disabled={uploading}
          className={`px-3 py-1.5 rounded-lg shadow-sm transition-colors ${
            uploading ? "bg-gray-500" : "bg-[#1e3a8a] hover:bg-[#1e40af]"
          } text-white text-sm font-medium`}
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
        <button
          onClick={() => {
            setShowFilesModal(true);
            fetchFiles(); // Refresh files when opening modal
          }}
          className="px-3 py-1.5 rounded-lg shadow-sm transition-colors bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium flex items-center gap-1.5"
        >
          <FileText size={14} />
          View Files
        </button>
        <input
          type="file"
          accept=".txt,.pdf,.docx"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Files Modal */}
      {showFilesModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-200">
            {/* Modal Header */}
            <div className="bg-[#1e3a8a] text-white px-6 py-4 rounded-t-xl flex items-center justify-between">
              <h3 className="text-lg font-bold uppercase tracking-wide">Uploaded Files</h3>
              <button
                onClick={() => setShowFilesModal(false)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingFiles ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Loading files...</p>
                </div>
              ) : files.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No knowledge base files uploaded yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file._id}
                      className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 px-4 py-3 rounded-lg border border-gray-200 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="w-5 h-5 text-[#1e3a8a] flex-shrink-0" />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-sm text-gray-800 truncate" title={file.filename}>
                            {file.filename}
                          </span>
                          {file.chunkCount !== undefined && (
                            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full flex-shrink-0">
                              {file.chunkCount} {file.chunkCount === 1 ? 'chunk' : 'chunks'}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteFile(file)}
                        disabled={deletingFileId === file._id}
                        className="px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-3 flex-shrink-0"
                      >
                        {deletingFileId === file._id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
              <button
                onClick={() => setShowFilesModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UploadContextModal;
