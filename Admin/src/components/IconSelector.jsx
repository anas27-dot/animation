import React, { useState, useMemo } from "react";
import { Search, ChevronDown, X } from "lucide-react";
import { SvgIcons } from "../utils/svgIconsComponents.jsx";
// Social platform icons: use fa6 (regular/brand style, single LinkedIn)
import {
  FaFacebook,
  FaTwitter,
  FaLinkedin,
  FaInstagram,
  FaYoutube,
  FaWhatsapp,
  FaTelegram,
  FaTiktok,
  FaPinterest,
  FaReddit,
  FaDiscord,
  FaSnapchat,
  FaGithub,
} from "react-icons/fa6";

// Comprehensive list of SVG icons - replacement for Font Awesome icons
const ALL_ICONS = [
  // Navigation & Basic (10)
  { name: "FaHome", label: "Home", category: "Navigation", component: SvgIcons.FaHome },
  { name: "FaGlobe", label: "Globe/Website", category: "Navigation", component: SvgIcons.FaGlobe },
  { name: "FaLink", label: "Link", category: "Navigation", component: SvgIcons.FaLink },
  { name: "FaBars", label: "Menu", category: "Navigation", component: SvgIcons.FaBars },
  { name: "FaArrowRight", label: "Arrow Right", category: "Navigation", component: SvgIcons.FaArrowRight },
  { name: "FaArrowLeft", label: "Arrow Left", category: "Navigation", component: SvgIcons.FaArrowLeft },
  { name: "FaChevronRight", label: "Chevron Right", category: "Navigation", component: SvgIcons.FaChevronRight },
  { name: "FaChevronLeft", label: "Chevron Left", category: "Navigation", component: SvgIcons.FaChevronLeft },
  { name: "FaTh", label: "Grid View", category: "Navigation", component: SvgIcons.FaTh },
  { name: "FaList", label: "List View", category: "Navigation", component: SvgIcons.FaList },

  // Communication (10)
  { name: "FaEnvelope", label: "Email", category: "Communication", component: SvgIcons.FaEnvelope },
  { name: "FaPhone", label: "Phone", category: "Communication", component: SvgIcons.FaPhone },
  { name: "FaPhoneAlt", label: "Phone Alt", category: "Communication", component: SvgIcons.FaPhoneAlt },
  { name: "FaComment", label: "Comment", category: "Communication", component: SvgIcons.FaComment },
  { name: "FaComments", label: "Comments", category: "Communication", component: SvgIcons.FaComments },
  { name: "FaPaperPlane", label: "Send Message", category: "Communication", component: SvgIcons.FaPaperPlane },
  { name: "FaInbox", label: "Inbox", category: "Communication", component: SvgIcons.FaInbox },
  { name: "FaBell", label: "Notifications", category: "Communication", component: SvgIcons.FaBell },
  { name: "FaRss", label: "RSS Feed", category: "Communication", component: SvgIcons.FaRss },
  { name: "FaAt", label: "Mention", category: "Communication", component: SvgIcons.FaAt },

  // Business & Commerce (10)
  { name: "FaShoppingCart", label: "Shopping Cart", category: "Business", component: SvgIcons.FaShoppingCart },
  { name: "FaStore", label: "Store/Shop", category: "Business", component: SvgIcons.FaStore },
  { name: "FaCreditCard", label: "Payment", category: "Business", component: SvgIcons.FaCreditCard },
  { name: "FaDollarSign", label: "Money/Price", category: "Business", svg: SvgIcons.FaDollarSign },
  { name: "FaTag", label: "Tag/Product", category: "Business", svg: SvgIcons.FaTag },
  { name: "FaTags", label: "Tags", category: "Business", svg: SvgIcons.FaTags },
  { name: "FaGift", label: "Gift/Offers", category: "Business", svg: SvgIcons.FaGift },
  { name: "FaPercent", label: "Discount", category: "Business", svg: SvgIcons.FaPercent },
  { name: "FaReceipt", label: "Receipt/Invoice", category: "Business", svg: SvgIcons.FaReceipt },
  { name: "FaHandshake", label: "Partnership", category: "Business", svg: SvgIcons.FaHandshake },

  // Content & Media (10)
  { name: "FaBook", label: "Book/Documentation", category: "Content", svg: SvgIcons.FaBook },
  { name: "FaFileAlt", label: "Document", category: "Content", svg: SvgIcons.FaFileAlt },
  { name: "FaNewspaper", label: "News/Blog", category: "Content", svg: SvgIcons.FaNewspaper },
  { name: "FaVideo", label: "Video", category: "Content", svg: SvgIcons.FaVideo },
  { name: "FaImage", label: "Image/Gallery", category: "Content", svg: SvgIcons.FaImage },
  { name: "FaImages", label: "Images", category: "Content", svg: SvgIcons.FaImages },
  { name: "FaMusic", label: "Music", category: "Content", svg: SvgIcons.FaMusic },
  { name: "FaFilm", label: "Movies", category: "Content", svg: SvgIcons.FaFilm },
  { name: "FaPodcast", label: "Podcast", category: "Content", svg: SvgIcons.FaPodcast },
  { name: "FaPlay", label: "Play Video", category: "Content", svg: SvgIcons.FaPlay },

  // User & Account (10)
  { name: "FaUser", label: "User/Profile", category: "User", svg: SvgIcons.FaUser },
  { name: "FaUserCircle", label: "User Circle", category: "User", svg: SvgIcons.FaUserCircle },
  { name: "FaUsers", label: "Users/Team", category: "User", svg: SvgIcons.FaUsers },
  { name: "FaUserFriends", label: "Friends", category: "User", svg: SvgIcons.FaUserFriends },
  { name: "FaUserPlus", label: "Add User", category: "User", svg: SvgIcons.FaUserPlus },
  { name: "FaUserCheck", label: "Verified User", category: "User", svg: SvgIcons.FaUserCheck },
  { name: "FaUserShield", label: "Admin/Protected", category: "User", svg: SvgIcons.FaUserShield },
  { name: "FaIdCard", label: "ID Card", category: "User", svg: SvgIcons.FaIdCard },
  { name: "FaAddressBook", label: "Contacts", category: "User", svg: SvgIcons.FaAddressBook },
  { name: "FaUserCog", label: "User Settings", category: "User", svg: SvgIcons.FaUserCog },

  // Tools & Settings (10)
  { name: "FaCog", label: "Settings", category: "Tools", svg: SvgIcons.FaCog },
  { name: "FaTools", label: "Tools", category: "Tools", svg: SvgIcons.FaTools },
  { name: "FaWrench", label: "Maintenance", category: "Tools", svg: SvgIcons.FaWrench },
  { name: "FaLock", label: "Security/Lock", category: "Tools", svg: SvgIcons.FaLock },
  { name: "FaKey", label: "Key/Access", category: "Tools", svg: SvgIcons.FaKey },
  { name: "FaShieldAlt", label: "Security", category: "Tools", svg: SvgIcons.FaShieldAlt },
  { name: "FaSearch", label: "Search", category: "Tools", svg: SvgIcons.FaSearch },
  { name: "FaFilter", label: "Filter", category: "Tools", svg: SvgIcons.FaFilter },
  { name: "FaSort", label: "Sort", category: "Tools", svg: SvgIcons.FaSort },
  { name: "FaDownload", label: "Download", category: "Tools", svg: SvgIcons.FaDownload },

  // Social & Sharing (10)
  { name: "FaShare", label: "Share", category: "Social", svg: SvgIcons.FaShare },
  { name: "FaShareAlt", label: "Share Alt", category: "Social", svg: SvgIcons.FaShareAlt },
  { name: "FaHeart", label: "Like/Favorite", category: "Social", svg: SvgIcons.FaHeart },
  { name: "FaStar", label: "Star/Rating", category: "Social", svg: SvgIcons.FaStar },
  { name: "FaThumbsUp", label: "Like", category: "Social", svg: SvgIcons.FaThumbsUp },
  { name: "FaThumbsDown", label: "Dislike", category: "Social", svg: SvgIcons.FaThumbsDown },
  { name: "FaBookmark", label: "Bookmark", category: "Social", svg: SvgIcons.FaBookmark },
  { name: "FaFlag", label: "Flag/Report", category: "Social", svg: SvgIcons.FaFlag },
  { name: "FaRetweet", label: "Retweet/Repost", category: "Social", svg: SvgIcons.FaRetweet },
  { name: "FaCommentDots", label: "Comment Dots", category: "Social", svg: SvgIcons.FaCommentDots },

  // Social Platforms (13) – fa6 regular/brand style, single LinkedIn
  { name: "FaFacebook", label: "Facebook", category: "Social Platforms", component: FaFacebook, svg: FaFacebook },
  { name: "FaTwitter", label: "Twitter / X", category: "Social Platforms", component: FaTwitter, svg: FaTwitter },
  { name: "FaLinkedin", label: "LinkedIn", category: "Social Platforms", component: FaLinkedin, svg: FaLinkedin },
  { name: "FaInstagram", label: "Instagram", category: "Social Platforms", component: FaInstagram, svg: FaInstagram },
  { name: "FaYoutube", label: "YouTube", category: "Social Platforms", component: FaYoutube, svg: FaYoutube },
  { name: "FaWhatsapp", label: "WhatsApp", category: "Social Platforms", component: FaWhatsapp, svg: FaWhatsapp },
  { name: "FaTelegram", label: "Telegram", category: "Social Platforms", component: FaTelegram, svg: FaTelegram },
  { name: "FaTiktok", label: "TikTok", category: "Social Platforms", component: FaTiktok, svg: FaTiktok },
  { name: "FaPinterest", label: "Pinterest", category: "Social Platforms", component: FaPinterest, svg: FaPinterest },
  { name: "FaReddit", label: "Reddit", category: "Social Platforms", component: FaReddit, svg: FaReddit },
  { name: "FaDiscord", label: "Discord", category: "Social Platforms", component: FaDiscord, svg: FaDiscord },
  { name: "FaSnapchat", label: "Snapchat", category: "Social Platforms", component: FaSnapchat, svg: FaSnapchat },
  { name: "FaGithub", label: "GitHub", category: "Social Platforms", component: FaGithub, svg: FaGithub },

  // Location & Maps (5)
  { name: "FaMap", label: "Map", category: "Location", svg: SvgIcons.FaMap },
  { name: "FaMapMarkerAlt", label: "Location Marker", category: "Location", svg: SvgIcons.FaMapMarkerAlt },
  { name: "FaMapPin", label: "Pin Location", category: "Location", svg: SvgIcons.FaMapPin },
  { name: "FaDirections", label: "Directions", category: "Location", svg: SvgIcons.FaDirections },
  { name: "FaRoute", label: "Route", category: "Location", svg: SvgIcons.FaRoute },

  // Actions & Utilities (10)
  { name: "FaPlus", label: "Add/Create", category: "Actions", svg: SvgIcons.FaPlus },
  { name: "FaEdit", label: "Edit", category: "Actions", svg: SvgIcons.FaEdit },
  { name: "FaTrash", label: "Delete", category: "Actions", svg: SvgIcons.FaTrash },
  { name: "FaSave", label: "Save", category: "Actions", svg: SvgIcons.FaSave },
  { name: "FaPrint", label: "Print", category: "Actions", svg: SvgIcons.FaPrint },
  { name: "FaCopy", label: "Copy", category: "Actions", svg: SvgIcons.FaCopy },
  { name: "FaCut", label: "Cut", category: "Actions", svg: SvgIcons.FaCut },
  { name: "FaPaste", label: "Paste", category: "Actions", svg: SvgIcons.FaPaste },
  { name: "FaUndo", label: "Undo", category: "Actions", svg: SvgIcons.FaUndo },
  { name: "FaRedo", label: "Redo", category: "Actions", svg: SvgIcons.FaRedo },

  // Special & Custom (5)
  { name: "FaInfoCircle", label: "Information", category: "Special", svg: SvgIcons.FaInfoCircle },
  { name: "FaQuestionCircle", label: "Help/FAQ", category: "Special", svg: SvgIcons.FaQuestionCircle },
  { name: "FaExclamationCircle", label: "Warning", category: "Special", svg: SvgIcons.FaExclamationCircle },
  { name: "FaCheckCircle", label: "Success/Check", category: "Special", svg: SvgIcons.FaCheckCircle },
  { name: "FaTimesCircle", label: "Error/Close", category: "Special", svg: SvgIcons.FaTimesCircle },
];

// All icons are now available as SVG components
const AVAILABLE_ICONS = ALL_ICONS;

const IconSelector = ({ value, onChange, className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter icons based on search query
  const filteredIcons = useMemo(() => {
    if (!searchQuery.trim()) {
      return AVAILABLE_ICONS;
    }
    const query = searchQuery.toLowerCase();
    return AVAILABLE_ICONS.filter(
      (icon) =>
        icon.name.toLowerCase().includes(query) ||
        icon.label.toLowerCase().includes(query) ||
        icon.category.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Get current icon component (svg or component)
  const currentIconEntry = value ? AVAILABLE_ICONS.find((icon) => icon.name === value) : null;
  const CurrentIcon = currentIconEntry?.svg || currentIconEntry?.component || null;

  // Group icons by category
  const groupedIcons = useMemo(() => {
    const groups = {};
    filteredIcons.forEach((icon) => {
      if (!groups[icon.category]) {
        groups[icon.category] = [];
      }
      groups[icon.category].push(icon);
    });
    return groups;
  }, [filteredIcons]);

  const handleSelectIcon = (iconName) => {
    onChange(iconName);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className={`relative ${className}`}>
      {/* Selected Icon Display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-700 bg-white flex items-center justify-between hover:border-teal-400 transition-colors"
      >
        <div className="flex items-center gap-3">
          {CurrentIcon ? (
            <>
              <CurrentIcon className="h-5 w-5 text-teal-600" />
              <span className="font-mono text-sm">{value}</span>
            </>
          ) : (
            <span className="text-gray-400">Select an icon...</span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform ${
            isOpen ? "transform rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Panel */}
          <div className="absolute z-20 mt-2 w-full bg-white border border-gray-300 rounded-lg shadow-xl max-h-96 overflow-hidden flex flex-col">
            {/* Search Bar */}
            <div className="p-3 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search icons..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Icons List */}
            <div className="overflow-y-auto flex-1">
              {Object.keys(groupedIcons).length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p>No icons found</p>
                </div>
              ) : (
                Object.entries(groupedIcons).map(([category, icons]) => (
                  <div key={category} className="mb-4">
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        {category}
                      </h3>
                    </div>
                    <div className="grid grid-cols-4 gap-2 p-3">
                      {icons.map((icon) => {
                        const isSelected = value === icon.name;

                        return (
                          <button
                            key={icon.name}
                            type="button"
                            onClick={() => handleSelectIcon(icon.name)}
                            className={`
                              flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all
                              ${
                                isSelected
                                  ? "border-teal-500 bg-teal-50"
                                  : "border-gray-200 hover:border-teal-300 hover:bg-gray-50"
                              }
                            `}
                            title={icon.label}
                          >
                            <div className={`h-6 w-6 mb-1 ${
                              isSelected ? "text-teal-600" : "text-gray-600"
                            }`}>
                              {React.createElement(icon.component || icon.svg || SvgIcons.FaQuestionCircle)}
                            </div>
                            <span
                              className={`text-xs font-mono truncate w-full text-center ${
                                isSelected ? "text-teal-700" : "text-gray-500"
                              }`}
                            >
                              {icon.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      <p className="mt-1 text-xs text-gray-500">
        Click to select an icon from {AVAILABLE_ICONS.length} available options
      </p>
    </div>
  );
};

export default IconSelector;

