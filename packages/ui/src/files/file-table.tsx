import type { FileId, StoredFile } from "@vantion/module-files/FilesRpc";
import { Download, Paperclip, Trash2 } from "lucide-react";
import { EmptyState } from "../app/empty-state.js";
import { Button } from "../ui/button.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table.js";

/** Bytes, in the units a person reads rather than the ones a disk uses. */
const size = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const FileTable = (props: {
  readonly files: ReadonlyArray<StoredFile>;
  readonly onDownload: (id: FileId) => void;
  readonly onDelete: (id: FileId) => void;
  /** False for a member, who may upload and read but not remove. */
  readonly canDelete: boolean;
}) => {
  if (props.files.length === 0) {
    return (
      <EmptyState
        icon={Paperclip}
        title="No files yet"
        description="Anything uploaded here belongs to this organization and nobody else's."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="w-32">Size</TableHead>
          <TableHead className="w-44">Added</TableHead>
          <TableHead className="w-28" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.files.map((file) => (
          <TableRow key={file.id}>
            <TableCell className="font-medium">{file.name}</TableCell>
            <TableCell className="text-muted-foreground text-sm">{size(file.size)}</TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {file.createdAt.slice(0, 16).replace("T", " ")}
            </TableCell>
            <TableCell className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Download ${file.name}`}
                onClick={() => props.onDownload(file.id)}
              >
                <Download className="size-4" aria-hidden />
              </Button>
              {props.canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete ${file.name}`}
                  onClick={() => props.onDelete(file.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
