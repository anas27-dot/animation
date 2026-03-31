import React from 'react';
import { FileText, Download, ExternalLink } from 'lucide-react';

const PDFAttachment = ({ fileName, fileUrl, fileSize }) => {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 max-w-xs my-2">
      <div className="p-2 bg-red-100 rounded-lg">
        <FileText className="w-6 h-6 text-red-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
        <p className="text-xs text-gray-500">{fileSize}</p>
      </div>
      <div className="flex gap-1">
        <a 
          href={fileUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="p-1.5 hover:bg-gray-200 rounded transition-colors text-slate-600"
          title="Open in new tab"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
        <a 
          href={fileUrl} 
          download={fileName} 
          className="p-1.5 hover:bg-gray-200 rounded transition-colors text-slate-600"
          title="Download"
        >
          <Download className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
};

export default PDFAttachment;
