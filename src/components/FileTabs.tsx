import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileItem {
  id: string;
  filename: string;
  language: string;
}

interface FileTabsProps {
  openFiles: FileItem[];
  activeFile: string | null;
  onFileSelect: (file: FileItem) => void;
  onFileClose: (fileId: string) => void;
}

export const FileTabs = ({ openFiles, activeFile, onFileSelect, onFileClose }: FileTabsProps) => {
  if (openFiles.length === 0) return null;

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-secondary/10 border-b border-border overflow-x-auto">
      {openFiles.map((file) => (
        <div
          key={file.id}
          className={`group flex items-center gap-2 px-3 py-1.5 rounded-t cursor-pointer transition-colors ${
            activeFile === file.id
              ? 'bg-background border-t border-x border-border'
              : 'bg-secondary/20 hover:bg-secondary/40'
          }`}
          onClick={() => onFileSelect(file)}
        >
          <span className="text-xs font-medium whitespace-nowrap">{file.filename}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/20"
            onClick={(e) => {
              e.stopPropagation();
              onFileClose(file.id);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
};
