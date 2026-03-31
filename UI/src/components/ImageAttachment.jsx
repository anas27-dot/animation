import React from 'react';
import { Download } from 'lucide-react';

const ImageAttachment = ({ fileName, fileUrl }) => {
  return (
    <div className="max-w-xs rounded-lg overflow-hidden border border-gray-200 my-2 bg-white">
      <img 
        src={fileUrl} 
        alt={fileName} 
        className="w-full h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => window.open(fileUrl, '_blank')}
      />
      <div className="flex items-center justify-between p-2 bg-gray-50 border-t border-gray-100">
        <span className="text-[10px] text-gray-500 truncate px-1">{fileName}</span>
        <a 
          href={fileUrl} 
          download={fileName} 
          className="p-1 hover:bg-gray-200 rounded transition-colors text-slate-600"
          title="Download"
        >
          <Download className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};

export default ImageAttachment;
