import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Position = {
  id: string;
  name: string;
  category: string;
  unit: string;
};

interface AddPositionDialogProps {
  hiddenPositions: Position[];
  onAddPositions: (positionIds: string[]) => void;
}

export function AddPositionDialog({ hiddenPositions, onAddPositions }: AddPositionDialogProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredPositions = useMemo(() => {
    if (!search.trim()) return hiddenPositions;
    const searchLower = search.toLowerCase();
    return hiddenPositions.filter(p => 
      p.name.toLowerCase().includes(searchLower) ||
      p.category.toLowerCase().includes(searchLower)
    );
  }, [hiddenPositions, search]);

  const groupedPositions = useMemo(() => {
    return filteredPositions.reduce((acc, position) => {
      if (!acc[position.category]) {
        acc[position.category] = [];
      }
      acc[position.category].push(position);
      return acc;
    }, {} as Record<string, Position[]>);
  }, [filteredPositions]);

  const togglePosition = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(p => p !== id)
        : [...prev, id]
    );
  };

  const handleAdd = () => {
    if (selectedIds.length > 0) {
      onAddPositions(selectedIds);
      setSelectedIds([]);
      setSearch("");
      setOpen(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setSelectedIds([]);
      setSearch("");
    }
  };

  if (hiddenPositions.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full min-h-[44px]">
          <Plus className="h-4 w-4 mr-2" />
          Добавить позицию ({hiddenPositions.length} скрыто)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Добавить позицию в отчёт</DialogTitle>
        </DialogHeader>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[300px] pr-4">
          {Object.keys(groupedPositions).length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Позиции не найдены
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedPositions).map(([category, positions]) => (
                <div key={category}>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    {category}
                  </h4>
                  <div className="space-y-1">
                    {positions.map(position => {
                      const isSelected = selectedIds.includes(position.id);
                      return (
                        <button
                          key={position.id}
                          onClick={() => togglePosition(position.id)}
                          className={cn(
                            "w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors",
                            "hover:bg-accent",
                            isSelected && "bg-primary/10 border border-primary/30"
                          )}
                        >
                          <div>
                            <span className="font-medium">{position.name}</span>
                            <span className="text-sm text-muted-foreground ml-2">
                              ({position.unit})
                            </span>
                          </div>
                          {isSelected && (
                            <Check className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => handleOpenChange(false)}
          >
            Отмена
          </Button>
          <Button 
            className="flex-1"
            onClick={handleAdd}
            disabled={selectedIds.length === 0}
          >
            Добавить ({selectedIds.length})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
