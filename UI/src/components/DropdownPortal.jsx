import { createPortal } from 'react-dom';

const DropdownPortal = ({ children, isOpen }) => {
  if (!isOpen) return null;

  return createPortal(
    children,
    document.body
  );
};

export default DropdownPortal;
