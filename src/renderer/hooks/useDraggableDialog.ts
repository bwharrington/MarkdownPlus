import { useRef, useState, useEffect, useCallback } from 'react';

interface Position {
    x: number;
    y: number;
}

type PositionStrategy = 'center' | 'top-right';

interface UseDraggableDialogOptions {
    initialPosition?: Position;
    positionStrategy?: PositionStrategy;
}

interface UseDraggableDialogReturn {
    dialogRef: React.RefObject<HTMLDivElement | null>;
    position: Position;
    isDragging: boolean;
    handleDragMouseDown: (e: React.MouseEvent) => void;
}

function computeInitialPosition(
    strategy: PositionStrategy,
    dialogRect: DOMRect,
    parentRect: DOMRect,
): Position {
    if (strategy === 'top-right') {
        return {
            x: parentRect.width - dialogRect.width - 16,
            y: 50,
        };
    }
    // center
    return {
        x: Math.max(0, (parentRect.width - dialogRect.width) / 2),
        y: Math.max(0, (parentRect.height - dialogRect.height) / 2),
    };
}

export function useDraggableDialog(
    isOpen: boolean,
    options?: UseDraggableDialogOptions,
): UseDraggableDialogReturn {
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const [position, setPosition] = useState<Position>(
        options?.initialPosition ?? { x: 100, y: 50 },
    );
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });

    const strategy = options?.positionStrategy ?? 'center';

    // Initialize position when dialog opens
    useEffect(() => {
        if (isOpen && dialogRef.current) {
            const rect = dialogRef.current.getBoundingClientRect();
            const parentRect = dialogRef.current.parentElement?.getBoundingClientRect();
            if (parentRect) {
                setPosition(computeInitialPosition(strategy, rect, parentRect));
            }
        }
    }, [isOpen, strategy]);

    const handleDragMouseDown = useCallback((e: React.MouseEvent) => {
        if (dialogRef.current) {
            setIsDragging(true);
            setDragStart({
                x: e.clientX - position.x,
                y: e.clientY - position.y,
            });
            e.preventDefault();
        }
    }, [position]);

    // Drag move/up listeners
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (dialogRef.current) {
                const parentRect = dialogRef.current.parentElement?.getBoundingClientRect();
                if (parentRect) {
                    const dialogRect = dialogRef.current.getBoundingClientRect();
                    const newX = Math.max(0, Math.min(e.clientX - dragStart.x, parentRect.width - dialogRect.width));
                    const newY = Math.max(0, Math.min(e.clientY - dragStart.y, parentRect.height - dialogRect.height));
                    setPosition({ x: newX, y: newY });
                }
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragStart]);

    return { dialogRef, position, isDragging, handleDragMouseDown };
}
