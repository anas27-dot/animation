// src/components/IconPicker.js

import React, { useState, useMemo, useRef, useEffect } from "react";
import styled from "styled-components";
import { getSvgIcon, SvgIcons } from "../utils/svgIcons.jsx";

// --- Styled Components for the Custom Dropdown ---
const PickerContainer = styled.div`
  position: relative;
  width: 100%;
  font-family: 'Inter', sans-serif;
`;

const PickerButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.5rem 0.75rem;
  background-color: white;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  cursor: pointer;
  text-align: left;
  &:focus {
    outline: 2px solid transparent;
    outline-offset: 2px;
    border-color: #3b82f6;
  }
`;

const SelectedValue = styled.span`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const DropdownPanel = styled.div`
  position: absolute;
  top: 105%;
  left: 0;
  width: 100%;
  max-height: 300px;
  background-color: white;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  z-index: 10;
  display: flex;
  flex-direction: column;
`;

const SearchInputContainer = styled.div`
  padding: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
`;

const OptionsList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0.25rem;
  overflow-y: auto;
`;

const Option = styled.li`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  border-radius: 0.25rem;
  &:hover {
    background-color: #f3f4f6;
  }
`;

const OptGroupLabel = styled.li`
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  position: sticky;
  top: 0;
  background-color: white;
`;


// --- Helper Functions ---
const iconNames = Object.keys(SvgIcons);

const categorizeIcons = (names) => {
    const categories = {
        'UI & Controls': [], 'Arrows': [], 'Communication': [], 'Business & Finance': [], 'Users & People': [], 'Social & Brands': [], 'Objects & Things': [], 'Miscellaneous': [],
    };
    const keywords = {
        'UI & Controls': ['Plus', 'Minus', 'Check', 'Times', 'Cog', 'Bars', 'Sliders', 'Search', 'Filter', 'Sort', 'Sync', 'Redo', 'Undo', 'PowerOff', 'Bell', 'Exclamation', 'Toggle', 'Circle'],
        'Arrows': ['Arrow', 'Caret', 'Chevron', 'Angle', 'Long', 'HandPoint'],
        'Communication': ['Comment', 'Envelope', 'Phone', 'Fax', 'Sms', 'Inbox', 'Rss', 'Broadcast', 'At', 'Mail'],
        'Business & Finance': ['Dollar', 'Euro', 'Chart', 'Briefcase', 'Building', 'Industry', 'Money', 'CreditCard', 'PiggyBank', 'BalanceScale', 'Calculator'],
        'Users & People': ['User', 'Users', 'Male', 'Female', 'Child', 'IdBadge', 'IdCard', 'Person'],
        'Social & Brands': ['Facebook', 'Twitter', 'Instagram', 'Linkedin', 'Github', 'Youtube', 'Google', 'Apple', 'Windows', 'Android', 'Spotify', 'Slack', 'Discord'],
        'Objects & Things': ['Key', 'Lock', 'Camera', 'Book', 'File', 'Folder', 'Tag', 'Clipboard', 'Trophy', 'Gift', 'Flag', 'Map', 'Image', 'Car', 'Plane', 'Ship'],
    };
    names.forEach(name => {
        let foundCategory = false;
        for (const category in keywords) {
            if (keywords[category].some(keyword => name.toLowerCase().includes(keyword.toLowerCase()))) {
                categories[category].push(name);
                foundCategory = true;
                break;
            }
        }
        if (!foundCategory) { categories['Miscellaneous'].push(name); }
    });
    for (const category in categories) { categories[category].sort(); }
    return categories;
};

// --- The Custom Icon Picker Component ---
const IconPicker = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const pickerRef = useRef(null);

  const categorizedIcons = useMemo(() => {
    const filtered = iconNames.filter(name =>
      name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return categorizeIcons(filtered);
  }, [searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectOption = (iconName) => {
    onChange(iconName);
    setIsOpen(false);
  };

  const SelectedIcon = getSvgIcon(value);

  return (
    <PickerContainer ref={pickerRef}>
      <PickerButton type="button" onClick={() => setIsOpen(!isOpen)}>
        <SelectedValue>
          {SelectedIcon}
          <span>{value}</span>
        </SelectedValue>
        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </PickerButton>

      {isOpen && (
        <DropdownPanel>
          <SearchInputContainer>
            <SearchInput
              type="text"
              placeholder="Search icons..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </SearchInputContainer>
          <OptionsList>
            {Object.keys(categorizedIcons).map(category =>
              categorizedIcons[category].length > 0 && (
                <React.Fragment key={category}>
                  <OptGroupLabel>{category}</OptGroupLabel>
                  {categorizedIcons[category].map(iconName => {
                    const IconSvg = getSvgIcon(iconName);
                    return (
                      <Option key={iconName} onClick={() => handleSelectOption(iconName)}>
                        <div className="text-gray-700">
                          {IconSvg}
                        </div>
                        <span>{iconName}</span>
                      </Option>
                    );
                  })}
                </React.Fragment>
              )
            )}
          </OptionsList>
        </DropdownPanel>
      )}
    </PickerContainer>
  );
};

export default IconPicker;