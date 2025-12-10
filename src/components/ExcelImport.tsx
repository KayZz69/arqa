import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, Check, AlertTriangle, X, Loader2, Plus } from "lucide-react";
import { format, addDays } from "date-fns";

const CATEGORIES = ["Выпечка", "Кухня", "Ингредиент", "Расходник", "Пицца"] as const;
const UNITS = ["кг", "л", "шт", "г", "мл", "уп"] as const;

interface Position {
  id: string;
  name: string;
  category: string;
  unit: string;
  shelf_life_days: number | null;
}

interface ParsedItem {
  originalName: string;
  quantity: number;
  costPerUnit: number;
  totalAmount: number;
  unit: string;
  matchedPosition: Position | null;
  matchStatus: "exact" | "similar" | "not_found";
  similarPositions: Position[];
}

interface ExcelImportProps {
  positions: Position[];
  onImportComplete: () => void;
}

export function ExcelImport({ positions: initialPositions, onImportComplete }: ExcelImportProps) {
  const [positions, setPositions] = useState<Position[]>(initialPositions);
  const [isOpen, setIsOpen] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [documentInfo, setDocumentInfo] = useState({ title: "", vendor: "", date: "" });
  const [arrivalDate, setArrivalDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for create position dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createItemIndex, setCreateItemIndex] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    unit: "шт" as string,
    category: "" as string,
    shelf_life_days: null as number | null,
  });
  const [isCreating, setIsCreating] = useState(false);

  // Sync positions when prop changes
  useEffect(() => {
    setPositions(initialPositions);
  }, [initialPositions]);

  const normalizeString = (str: string): string => {
    return str.toLowerCase().trim().replace(/\s+/g, " ");
  };

  const findSimilarPositions = (name: string): Position[] => {
    const normalized = normalizeString(name);
    const words = normalized.split(" ").filter(w => w.length > 2);
    
    return positions.filter(p => {
      const posName = normalizeString(p.name);
      // Check if any word from search matches position name
      return words.some(word => posName.includes(word));
    }).slice(0, 3);
  };

  const matchPosition = (name: string): { position: Position | null; status: "exact" | "similar" | "not_found"; similar: Position[] } => {
    const normalized = normalizeString(name);
    
    // Exact match
    const exact = positions.find(p => normalizeString(p.name) === normalized);
    if (exact) return { position: exact, status: "exact", similar: [] };

    // Partial match (position name contains search or vice versa)
    const partial = positions.find(p => 
      normalizeString(p.name).includes(normalized) || 
      normalized.includes(normalizeString(p.name))
    );
    if (partial) return { position: partial, status: "similar", similar: [] };

    // Find similar
    const similar = findSimilarPositions(name);
    if (similar.length > 0) {
      return { position: null, status: "similar", similar };
    }

    return { position: null, status: "not_found", similar: [] };
  };

  const parseHtmlFile = (content: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");

    // Extract document info
    const title = doc.querySelector("h1")?.textContent?.trim() || "";
    const vendorRow = Array.from(doc.querySelectorAll("tr")).find(row => 
      row.textContent?.includes("Vendor:")
    );
    const vendor = vendorRow?.querySelector(".secondcol")?.textContent?.trim() || "";
    
    // Extract date from title
    const dateMatch = title.match(/(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(\d{4})/i);
    let date = format(new Date(), "yyyy-MM-dd");
    if (dateMatch) {
      const months: Record<string, string> = {
        "января": "01", "февраля": "02", "марта": "03", "апреля": "04",
        "мая": "05", "июня": "06", "июля": "07", "августа": "08",
        "сентября": "09", "октября": "10", "ноября": "11", "декабря": "12"
      };
      const day = dateMatch[1].padStart(2, "0");
      const month = months[dateMatch[2].toLowerCase()];
      const year = dateMatch[3];
      date = `${year}-${month}-${day}`;
    }

    setDocumentInfo({ title, vendor, date });
    setArrivalDate(date);

    // Find the items table
    const reportTable = doc.querySelector("table.report");
    if (!reportTable) {
      toast({ title: "Ошибка", description: "Не удалось найти таблицу товаров", variant: "destructive" });
      return;
    }

    const rows = reportTable.querySelectorAll("tbody > tr:not(.row-resume)");
    const items: ParsedItem[] = [];

    rows.forEach(row => {
      const cells = row.querySelectorAll("td");
      if (cells.length < 8) return;

      const itemName = cells[3]?.textContent?.trim();
      const quantityText = cells[4]?.querySelector(".sum")?.textContent?.trim();
      const unit = cells[5]?.textContent?.trim() || "шт";
      const costText = cells[6]?.querySelector(".sum")?.textContent?.trim();
      const amountText = cells[7]?.querySelector(".sum")?.textContent?.trim();

      if (!itemName || !quantityText) return;

      const quantity = parseFloat(quantityText.replace(/\s/g, "").replace(",", ".")) || 0;
      const costPerUnit = parseFloat(costText?.replace(/\s/g, "").replace(",", ".") || "0") || 0;
      const totalAmount = parseFloat(amountText?.replace(/\s/g, "").replace(",", ".") || "0") || 0;

      const match = matchPosition(itemName);
      
      items.push({
        originalName: itemName,
        quantity,
        costPerUnit,
        totalAmount,
        unit,
        matchedPosition: match.position,
        matchStatus: match.status,
        similarPositions: match.similar,
      });
    });

    setParsedItems(items);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      parseHtmlFile(content);
      setIsOpen(true);
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const updateItemPosition = (index: number, positionId: string) => {
    const position = positionId === "__skip__" ? null : positions.find(p => p.id === positionId) || null;
    const updated = [...parsedItems];
    updated[index] = {
      ...updated[index],
      matchedPosition: position,
      matchStatus: position ? "exact" : "not_found",
    };
    setParsedItems(updated);
  };

  const handleSelectChange = (index: number, value: string) => {
    if (value === "__create__") {
      const item = parsedItems[index];
      setCreateItemIndex(index);
      setCreateForm({
        name: item.originalName,
        unit: UNITS.includes(item.unit as typeof UNITS[number]) ? item.unit : "шт",
        category: "",
        shelf_life_days: null,
      });
      setCreateDialogOpen(true);
    } else {
      updateItemPosition(index, value);
    }
  };

  const handleCreatePosition = async () => {
    if (!createForm.category) {
      toast({ title: "Ошибка", description: "Выберите категорию", variant: "destructive" });
      return;
    }
    if (createItemIndex === null) return;

    setIsCreating(true);
    try {
      const item = parsedItems[createItemIndex];
      
      const { data, error } = await supabase
        .from("positions")
        .insert({
          name: createForm.name,
          category: createForm.category,
          unit: createForm.unit,
          shelf_life_days: createForm.shelf_life_days,
          min_stock: 5,
          order_quantity: 10,
          active: true,
          last_cost: item.costPerUnit,
        })
        .select()
        .single();

      if (error) throw error;

      const newPosition: Position = {
        id: data.id,
        name: data.name,
        category: data.category,
        unit: data.unit,
        shelf_life_days: data.shelf_life_days,
      };

      // Update local positions list
      setPositions(prev => [...prev, newPosition]);

      // Link the new position to the parsed item
      const updated = [...parsedItems];
      updated[createItemIndex] = {
        ...updated[createItemIndex],
        matchedPosition: newPosition,
        matchStatus: "exact",
      };
      setParsedItems(updated);

      toast({ title: "Позиция создана", description: `"${newPosition.name}" добавлена в систему` });
      setCreateDialogOpen(false);
      setCreateItemIndex(null);
    } catch (error) {
      console.error("Create position error:", error);
      toast({ title: "Ошибка", description: "Не удалось создать позицию", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const calculateExpiryDate = (arrivalDate: string, shelfLifeDays: number | null): string | null => {
    if (!shelfLifeDays) return null;
    return format(addDays(new Date(arrivalDate), shelfLifeDays), "yyyy-MM-dd");
  };

  const handleImport = async () => {
    const validItems = parsedItems.filter(item => item.matchedPosition);
    if (validItems.length === 0) {
      toast({ title: "Ошибка", description: "Нет позиций для импорта", variant: "destructive" });
      return;
    }

    setIsImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const batchRecords = validItems.map(item => ({
        position_id: item.matchedPosition!.id,
        quantity: item.quantity,
        cost_per_unit: item.costPerUnit,
        arrival_date: arrivalDate,
        expiry_date: calculateExpiryDate(arrivalDate, item.matchedPosition!.shelf_life_days),
        created_by: user.id,
      }));

      const { error: batchError } = await supabase.from("inventory_batches").insert(batchRecords);
      if (batchError) throw batchError;

      // Update last_cost for each position
      for (const item of validItems) {
        if (item.costPerUnit > 0) {
          await supabase
            .from("positions")
            .update({ last_cost: item.costPerUnit })
            .eq("id", item.matchedPosition!.id);
        }
      }

      const totalAmount = validItems.reduce((sum, item) => sum + item.totalAmount, 0);
      toast({ 
        title: "Импорт завершён", 
        description: `Добавлено ${validItems.length} позиций на сумму ${totalAmount.toLocaleString()}₸` 
      });
      
      setIsOpen(false);
      setParsedItems([]);
      onImportComplete();
    } catch (error) {
      console.error("Import error:", error);
      toast({ title: "Ошибка импорта", description: "Не удалось импортировать данные", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const matchedCount = parsedItems.filter(item => item.matchedPosition).length;
  const totalAmount = parsedItems
    .filter(item => item.matchedPosition)
    .reduce((sum, item) => sum + item.totalAmount, 0);

  return (
    <>
      <div className="flex items-center gap-2">
        <Input
          ref={fileInputRef}
          type="file"
          accept=".xls,.xlsx,.html"
          onChange={handleFileChange}
          className="hidden"
          id="excel-import"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          Импорт из учётной системы
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Импорт поступления
            </DialogTitle>
            <DialogDescription>
              {documentInfo.title && <div>{documentInfo.title}</div>}
              {documentInfo.vendor && <div>Поставщик: {documentInfo.vendor}</div>}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor="import-date">Дата прихода</Label>
                <Input
                  id="import-date"
                  type="date"
                  value={arrivalDate}
                  onChange={(e) => setArrivalDate(e.target.value)}
                />
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Будет импортировано</div>
                <div className="text-lg font-semibold">{matchedCount} из {parsedItems.length}</div>
                <div className="text-sm text-muted-foreground">на сумму {totalAmount.toLocaleString()}₸</div>
              </div>
            </div>

            <div className="rounded-md border overflow-auto flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Ст.</TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead className="text-right">Кол-во</TableHead>
                    <TableHead className="text-right">Цена</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                    <TableHead>Позиция в системе</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {item.matchStatus === "exact" && item.matchedPosition && (
                          <Check className="h-4 w-4 text-green-600" />
                        )}
                        {item.matchStatus === "similar" && (
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        )}
                        {item.matchStatus === "not_found" && !item.matchedPosition && (
                          <X className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{item.originalName}</div>
                        <div className="text-xs text-muted-foreground">{item.unit}</div>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{item.costPerUnit.toLocaleString()}₸</TableCell>
                      <TableCell className="text-right font-medium">{item.totalAmount.toLocaleString()}₸</TableCell>
                      <TableCell>
                        <Select
                          value={item.matchedPosition?.id || "__skip__"}
                          onValueChange={(value) => handleSelectChange(index, value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Выберите позицию" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="__skip__">— Пропустить —</SelectItem>
                            {/* Show matched/similar first */}
                            {item.matchedPosition && (
                              <SelectItem value={item.matchedPosition.id}>
                                ✓ {item.matchedPosition.name}
                              </SelectItem>
                            )}
                            {item.similarPositions.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                ~ {p.name}
                              </SelectItem>
                            ))}
                            {/* Create new option */}
                            <SelectItem value="__create__" className="text-primary font-medium">
                              <span className="flex items-center gap-1">
                                <Plus className="h-3 w-3" />
                                Создать "{item.originalName}"
                              </span>
                            </SelectItem>
                            {/* Then all others */}
                            {positions
                              .filter(p => 
                                p.id !== item.matchedPosition?.id && 
                                !item.similarPositions.find(sp => sp.id === p.id)
                              )
                              .map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.category} — {p.name}
                                </SelectItem>
                              ))
                            }
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>Отмена</Button>
            <Button onClick={handleImport} disabled={matchedCount === 0 || isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Импорт...
                </>
              ) : (
                `Импортировать ${matchedCount} позиций`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Position Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать позицию</DialogTitle>
            <DialogDescription>
              Новая позиция будет добавлена в систему и привязана к этой строке импорта
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="create-name">Название</Label>
              <Input
                id="create-name"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-category">Категория *</Label>
              <Select
                value={createForm.category}
                onValueChange={(value) => setCreateForm({ ...createForm, category: value })}
              >
                <SelectTrigger id="create-category">
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-unit">Единица измерения</Label>
              <Select
                value={createForm.unit}
                onValueChange={(value) => setCreateForm({ ...createForm, unit: value })}
              >
                <SelectTrigger id="create-unit">
                  <SelectValue placeholder="Выберите единицу" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-shelf-life">Срок годности (дни)</Label>
              <Input
                id="create-shelf-life"
                type="number"
                min="0"
                value={createForm.shelf_life_days ?? ""}
                onChange={(e) => setCreateForm({ 
                  ...createForm, 
                  shelf_life_days: e.target.value ? parseInt(e.target.value) : null 
                })}
                placeholder="Необязательно"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreatePosition} disabled={!createForm.category || isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Создание...
                </>
              ) : (
                "Создать"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
