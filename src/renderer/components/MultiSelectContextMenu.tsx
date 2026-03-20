import React, { useCallback } from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import { FolderOpenIcon, PlusIcon, DeleteIcon } from './AppIcons';

interface ContextMenuPosition {
    mouseX: number;
    mouseY: number;
}

interface MultiSelectContextMenuProps {
    position: ContextMenuPosition | null;
    selectedCount: number;
    onClose: () => void;
    onOpenAll: () => void;
    onAttachAll: () => void;
    onDeleteAll: () => void;
}

export const MultiSelectContextMenu = React.memo(function MultiSelectContextMenu({
    position,
    selectedCount,
    onClose,
    onOpenAll,
    onAttachAll,
    onDeleteAll,
}: MultiSelectContextMenuProps) {
    const open = position !== null;

    const handleOpenAll = useCallback(() => { onOpenAll(); onClose(); }, [onOpenAll, onClose]);
    const handleAttachAll = useCallback(() => { onAttachAll(); onClose(); }, [onAttachAll, onClose]);
    const handleDeleteAll = useCallback(() => { onDeleteAll(); onClose(); }, [onDeleteAll, onClose]);

    return (
        <Menu
            open={open}
            onClose={onClose}
            anchorReference="anchorPosition"
            anchorPosition={position ? { top: position.mouseY, left: position.mouseX } : undefined}
        >
            <MenuItem onClick={handleOpenAll}>
                <ListItemIcon><FolderOpenIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Open All ({selectedCount} files)</ListItemText>
            </MenuItem>
            <MenuItem onClick={handleAttachAll}>
                <ListItemIcon><PlusIcon fontSize="small" sx={{ color: 'success.main' }} /></ListItemIcon>
                <ListItemText>Attach All to Nexus AI</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleDeleteAll}>
                <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
                <ListItemText>Delete All ({selectedCount} files)</ListItemText>
            </MenuItem>
        </Menu>
    );
});
