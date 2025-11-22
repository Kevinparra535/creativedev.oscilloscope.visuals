import { useRef } from "react";
import styled from "styled-components";

const UploadContainer = styled.div`
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const UploadButton = styled.label`
  padding: 8px 16px;
  background: rgba(0, 255, 0, 0.1);
  border: 1px solid rgba(0, 255, 0, 0.4);
  border-radius: 4px;
  color: #00ff00;
  font-family: "Courier New", monospace;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;

  &:hover {
    background: rgba(0, 255, 0, 0.2);
    border-color: rgba(0, 255, 0, 0.6);
  }

  &:active {
    background: rgba(0, 255, 0, 0.3);
  }
`;

const HiddenInput = styled.input`
  display: none;
`;

const FileName = styled.div`
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(0, 255, 0, 0.3);
  border-radius: 4px;
  color: #00ff00;
  font-family: "Courier New", monospace;
  font-size: 11px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

interface AudioFileUploadProps {
  onFileSelect: (file: File) => void;
  currentFile?: string;
  show: boolean;
}

const AudioFileUpload = ({
  onFileSelect,
  currentFile,
  show,
}: AudioFileUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      onFileSelect(file);
    }
  };

  if (!show) return null;

  return (
    <UploadContainer>
      <UploadButton htmlFor="audio-upload">
        📁 Upload Audio File
      </UploadButton>
      <HiddenInput
        ref={inputRef}
        id="audio-upload"
        type="file"
        accept="audio/*"
        onChange={handleChange}
      />
      {currentFile && <FileName>🎵 {currentFile}</FileName>}
    </UploadContainer>
  );
};

export default AudioFileUpload;
