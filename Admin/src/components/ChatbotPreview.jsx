// src/components/ChatbotPreview.js

import React from "react";
import styled, { createGlobalStyle } from "styled-components";
import { IoSend } from "react-icons/io5";
import { FiMic } from "react-icons/fi";
import { Volume2, VolumeX } from "lucide-react";
import { getSvgIcon } from "../utils/svgIcons.jsx";

// --- FIXED: This component now dynamically injects ONLY the selected font ---
// It uses the 'fontFamily' prop to build the correct Google Fonts URL.
// In ChatbotPreview.jsx
const familyToWeights = (family) => {
  // Broad default for most families
  const defaultWeights = "wght@400;500;600;700";
  // Script fonts typically only need 400
  const scriptFamilies = new Set(["Pacifico", "Lobster", "Caveat"]);
  // Mono families: common weights
  const monoFamilies = new Set(["Source Code Pro", "Inconsolata"]);
  if (scriptFamilies.has(family)) return "wght@400";
  if (monoFamilies.has(family)) return "wght@400;700";
  // Serif families: 400;700 sufficient
  const serifFamilies = new Set([
    "Lora",
    "Playfair Display",
    "Merriweather",
    "Times New Roman",
  ]);
  if (serifFamilies.has(family)) return "wght@400;700";
  return defaultWeights;
};

const DynamicFontInjector = ({ fontFamily }) => {
  React.useEffect(() => {
    if (fontFamily && fontFamily !== 'Arial') {
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, "+")}:${familyToWeights(fontFamily)}&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
      
      return () => {
        document.head.removeChild(link);
      };
    }
  }, [fontFamily]);
  
  return null;
};

const Chatbox = styled.div`
  width: 100%;
  height: 100%;
  background: #ffffff;
  border-radius: 0.875rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* This CSS rule correctly applies the font family name */
  font-family: "${(p) => p.fontFamily || "Inter"}", -apple-system,
    BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans",
    "Apple Color Emoji", "Segoe UI Emoji", sans-serif;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: ${(props) =>
    props.$bgColor || "linear-gradient(90deg, #e53988, #5b37eb)"};
  color: #ffffff;
  flex-shrink: 0;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const Avatar = styled.img`
  width: 45px;
  height: 45px;
  border-radius: 50%;
  margin-right: 0.75rem;
`;

const TitleContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const BotName = styled.div`
  font-weight: 700;
  font-size: 1.25rem;
  line-height: 1.2;
`;

const BotSubtitle = styled.div`
  font-size: 0.8rem;
  font-weight: 400;
  color: #e0e0e0;
  line-height: 1.2;
`;

const MuteToggle = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: white;
  transition: all 0.2s ease-in-out;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.05);
  }
  
  &:active {
    transform: scale(0.95);
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: white;
  font-size: 1.75rem;
  font-weight: bold;
  cursor: pointer;
  line-height: 1;
  padding: 0.25rem;
  transition: transform 0.2s ease-in-out;
  &:hover {
    transform: rotate(90deg);
  }
`;

const ChatContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.25rem;
  overflow-y: auto;
  background: ${(props) => {
    if (props.$bgImage) {
      return `url(${props.$bgImage})`;
    } else if (props.$bgColor) {
      return props.$bgColor;
    }
    return "#ffffff";
  }};
  background-size: cover;
  background-position: center;
`;
const MessageBubble = styled.div`
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(5px);
  border: 1px solid rgba(200, 200, 200, 0.5);
  padding: 0.75rem 1rem;
  border-radius: 1.25rem;
  margin-bottom: 1.25rem;
  max-width: 85%;
  color: #333;
`;
const SuggestionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;
const SuggestionButton = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f9f9f9;
  color: #111;
  border: 1px solid transparent;
  border-radius: 14px;
  padding: 12px 16px;
  font-size: 14px;
  cursor: pointer;
  text-align: left;
  transition: all 0.25s ease;
  width: 100%;

  .label-text {
    transition: all 0.25s ease;
  }

  &:hover {
    border: 1px solid #ddd;

    .label-text {
      background: linear-gradient(
        90deg,
        hsla(344, 97%, 63%, 1),
        hsla(232, 90%, 59%, 1)
      );
      -webkit-background-clip: text;
      -moz-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
  }
`;
const IconWrapper = styled.div`
  background: ${(props) => props.$bgColor || "#6366f1"};
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: white;
`;
const InputContainer = styled.div`
  flex-shrink: 0;
  padding: 1rem;
  border-top: 1px solid #eee;
  background: white;
  margin-top: auto;
`;
const ChatInputWrapper = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;
const ChatInput = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 10px;
  outline: none;
  &:focus {
    border-color: #a97fff;
  }
`;
const SendButton = styled.button`
  background: ${(props) => props.$bgColor || "#3b8276"};
  border: none;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: ${(props) => props.$textColor || "#FFFFFF"};
  flex-shrink: 0;
`;

const ChatbotPreview = ({
  botSubtitle,
  welcomeMessage,
  suggestions,
  headerColor,
  buttonColor,
  textColor,
  bgImage,
  bgColor,
  fontFamily,
  includeSuggestionButton = true,
  includeAudio = false,
}) => {
  const [isMuted, setIsMuted] = React.useState(false);

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <>
      <DynamicFontInjector fontFamily={fontFamily} />
      <Chatbox fontFamily={fontFamily}>
        <Header $bgColor={headerColor}>
          <HeaderLeft>
            <Avatar
              src="https://raw.githubusercontent.com/troika-tech/Asset/refs/heads/main/supa-7-aug.png"
              alt="avatar"
            />
            <TitleContainer>
              <BotName>Supa Agent</BotName>
              <BotSubtitle>{botSubtitle}</BotSubtitle>
            </TitleContainer>
          </HeaderLeft>
          <HeaderRight>
            {includeAudio && (
              <MuteToggle onClick={toggleMute} isMuted={isMuted}>
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </MuteToggle>
            )}
            <CloseButton>&times;</CloseButton>
          </HeaderRight>
        </Header>

        <ChatContainer $bgImage={bgImage} $bgColor={bgColor}>
          <div style={{ flex: 1 }}>
            <MessageBubble>
              <p>{welcomeMessage}</p>
            </MessageBubble>
          </div>
          {includeSuggestionButton && suggestions.length > 0 && (
            <div>
              <p
                style={{ fontSize: "13px", color: "#666", marginBottom: "10px" }}
              >
                Or try one of these:
              </p>
              <SuggestionsContainer>
                {suggestions.map((suggestion, index) => {
                  const IconSvg = getSvgIcon(suggestion.icon);
                  return suggestion.label ? (
                    <SuggestionButton key={index}>
                      <IconWrapper $bgColor={suggestion.bg}>
                        {IconSvg}
                      </IconWrapper>
                      <span className="label-text">{suggestion.label}</span>
                    </SuggestionButton>
                  ) : null;
                })}
              </SuggestionsContainer>
            </div>
          )}
        </ChatContainer>

        <InputContainer>
          <ChatInputWrapper>
            <ChatInput placeholder="Type your message..." disabled />
            <SendButton $bgColor={buttonColor} $textColor={textColor}>
              <FiMic size={20} />
            </SendButton>
            <SendButton $bgColor={buttonColor} $textColor={textColor}>
              <IoSend size={20} />
            </SendButton>
          </ChatInputWrapper>
        </InputContainer>
      </Chatbox>
    </>
  );
};

export default ChatbotPreview;
