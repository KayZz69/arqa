import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Pencil, ArrowLeft, Tags } from "lucide-react";
import { z } from "zod";
import { filterItemsByQuery } from "@/lib/search";

const UNITS = ["кг", "л", "шт", "г", "мл", "уп"] as const;

const positionSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  category: z.string().trim().min(1, "Category is required"),
  unit: z.enum(UNITS, { required_error: "Unit is required" }),
  shelf_life_days: z.number().int().min(0).nullable(),
  active: z.boolean(),
  min_stock: z.number().min(0),
  order_quantity: z.number().min(0),
});

const categorySchema = z.object({
  name: z.string().trim().min(1, "Название обязательно").max(50),
  sort_order: z.number().int().min(0),
  active: z.boolean(),
});

type Category = {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
  created_at: string;
};

type Position = {
  id: string;
  name: string;
  category: string;
  unit: string;
  shelf_life_days: number | null;
  active: boolean;
  min_stock: number;
  order_quantity: number;
  created_at: string;
  updated_at: string;
};

type PositionForm = Omit<Position, "id" | "created_at" | "updated_at">;
type CategoryForm = Omit<Category, "id" | "created_at">;

const Positions = () => {
  const navigate = useNavigate();
  const { role, loading: roleLoading } = useUserRole();
  
  // Positions state
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [positionSearch, setPositionSearch] = useState("");
  const [formData, setFormData] = useState<PositionForm>({
    name: "",
    category: "",
    unit: "",
    shelf_life_days: null,
    active: true,
    min_stock: 5,
    order_quantity: 10,
  });

  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryFormData, setCategoryFormData] = useState<CategoryForm>({
    name: "",
    sort_order: 0,
    active: true,
  });

  useEffect(() => {
    if (!roleLoading && role !== "manager") {
      toast.error("Доступ запрещён. Требуется роль менеджера.");
      navigate("/");
    }
  }, [role, roleLoading, navigate]);

  useEffect(() => {
    fetchCategories();
    fetchPositions();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order");

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      toast.error("Не удалось загрузить категории");
      console.error("Error:", error);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const fetchPositions = async () => {
    try {
      const { data, error } = await supabase
        .from("positions")
        .select("*")
        .order("category")
        .order("name");

      if (error) throw error;
      setPositions(data || []);
    } catch (error: any) {
      toast.error("Не удалось загрузить позиции");
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Inline edit refs and handlers
  const updateTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  
  const handleInlineUpdate = useCallback(async (
    positionId: string, 
    field: 'min_stock' | 'order_quantity' | 'active', 
    value: number | boolean
  ) => {
    // Update local state immediately for instant feedback
    setPositions(prev => prev.map(p => 
      p.id === positionId ? { ...p, [field]: value } : p
    ));
    
    // Clear existing timeout for this position+field
    const timeoutKey = `${positionId}-${field}`;
    if (updateTimeouts.current[timeoutKey]) {
      clearTimeout(updateTimeouts.current[timeoutKey]);
    }
    
    // Debounce the database update
    updateTimeouts.current[timeoutKey] = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from("positions")
          .update({ [field]: value })
          .eq("id", positionId);
        
        if (error) throw error;
      } catch (error: any) {
        toast.error("Не удалось сохранить изменение");
        console.error("Error:", error);
        // Revert on error
        fetchPositions();
      }
    }, 500);
  }, []);

  // Position handlers
  const handleOpenDialog = (position?: Position) => {
    if (position) {
      setEditingPosition(position);
      setFormData({
        name: position.name,
        category: position.category,
        unit: position.unit,
        shelf_life_days: position.shelf_life_days,
        active: position.active,
        min_stock: position.min_stock,
        order_quantity: position.order_quantity,
      });
    } else {
      setEditingPosition(null);
      setFormData({
        name: "",
        category: "",
        unit: "",
        shelf_life_days: null,
        active: true,
        min_stock: 5,
        order_quantity: 10,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPosition(null);
    setFormData({
      name: "",
      category: "",
      unit: "",
      shelf_life_days: null,
      active: true,
      min_stock: 5,
      order_quantity: 10,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validatedData = positionSchema.parse(formData);

      if (editingPosition) {
        const { error } = await supabase
          .from("positions")
          .update({
            name: validatedData.name,
            category: validatedData.category,
            unit: validatedData.unit,
            shelf_life_days: validatedData.shelf_life_days,
            active: validatedData.active,
            min_stock: validatedData.min_stock,
            order_quantity: validatedData.order_quantity,
          })
          .eq("id", editingPosition.id);

        if (error) throw error;
        toast.success("Позиция успешно обновлена");
      } else {
        const { error } = await supabase
          .from("positions")
          .insert([{
            name: validatedData.name,
            category: validatedData.category,
            unit: validatedData.unit,
            shelf_life_days: validatedData.shelf_life_days,
            active: validatedData.active,
            min_stock: validatedData.min_stock,
            order_quantity: validatedData.order_quantity,
          }]);

        if (error) throw error;
        toast.success("Позиция успешно создана");
      }

      handleCloseDialog();
      fetchPositions();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Не удалось сохранить позицию");
        console.error("Error:", error);
      }
    }
  };

  // Category handlers
  const handleOpenCategoryDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setCategoryFormData({
        name: category.name,
        sort_order: category.sort_order,
        active: category.active,
      });
    } else {
      setEditingCategory(null);
      const maxOrder = categories.length > 0 
        ? Math.max(...categories.map(c => c.sort_order)) + 1 
        : 0;
      setCategoryFormData({
        name: "",
        sort_order: maxOrder,
        active: true,
      });
    }
    setCategoryDialogOpen(true);
  };

  const handleCloseCategoryDialog = () => {
    setCategoryDialogOpen(false);
    setEditingCategory(null);
    setCategoryFormData({
      name: "",
      sort_order: 0,
      active: true,
    });
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validatedData = categorySchema.parse(categoryFormData);

      if (editingCategory) {
        const { error } = await supabase
          .from("categories")
          .update({
            name: validatedData.name,
            sort_order: validatedData.sort_order,
            active: validatedData.active,
          })
          .eq("id", editingCategory.id);

        if (error) throw error;
        toast.success("Категория обновлена");
      } else {
        const { error } = await supabase
          .from("categories")
          .insert([{
            name: validatedData.name,
            sort_order: validatedData.sort_order,
            active: validatedData.active,
          }]);

        if (error) throw error;
        toast.success("Категория создана");
      }

      handleCloseCategoryDialog();
      fetchCategories();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error.code === "23505") {
        toast.error("Категория с таким названием уже существует");
      } else {
        toast.error("Не удалось сохранить категорию");
        console.error("Error:", error);
      }
    }
  };

  const filteredPositions = useMemo(() => filterItemsByQuery(
    positions,
    positionSearch,
    (position) => `${position.name} ${position.category}`
  ), [positions, positionSearch]);

  if (roleLoading || loading || categoriesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  // Get active categories for position form
  const activeCategories = categories.filter(c => c.active);

  const hasSearch = positionSearch.trim().length > 0;

  // Group positions by category, sorted by category sort_order
  const groupedPositions = filteredPositions.reduce((acc, position) => {
    if (!acc[position.category]) {
      acc[position.category] = [];
    }
    acc[position.category].push(position);
    return acc;
  }, {} as Record<string, Position[]>);

  // Sort categories by their sort_order
  const sortedCategoryNames = Object.keys(groupedPositions).sort((a, b) => {
    const catA = categories.find(c => c.name === a);
    const catB = categories.find(c => c.name === b);
    return (catA?.sort_order ?? 999) - (catB?.sort_order ?? 999);
  });

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 animate-fade-in">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Управление позициями</h1>
              <p className="text-muted-foreground">Управление позициями инвентаря, категориями и настройками</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="positions" className="space-y-6">
          <TabsList>
            <TabsTrigger value="positions">Позиции</TabsTrigger>
            <TabsTrigger value="categories">
              <Tags className="h-4 w-4 mr-2" />
              Категории
            </TabsTrigger>
          </TabsList>

          {/* Positions Tab */}
          <TabsContent value="positions" className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Input
                value={positionSearch}
                onChange={(e) => setPositionSearch(e.target.value)}
                placeholder="Поиск позиций"
                className="sm:max-w-xs"
              />
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => handleOpenDialog()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить позицию
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleSubmit}>
                    <DialogHeader>
                      <DialogTitle>{editingPosition ? "Редактировать позицию" : "Добавить новую позицию"}</DialogTitle>
                      <DialogDescription>
                        {editingPosition ? "Обновите детали позиции" : "Создать новую позицию инвентаря"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">Название</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="например, Молоко цельное"
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="category">Категория</Label>
                        <Select
                          value={formData.category}
                          onValueChange={(value) => setFormData({ ...formData, category: value })}
                        >
                          <SelectTrigger id="category">
                            <SelectValue placeholder="Выберите категорию" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            {activeCategories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.name}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="unit">Единица измерения</Label>
                        <Select
                          value={formData.unit}
                          onValueChange={(value) => setFormData({ ...formData, unit: value })}
                        >
                          <SelectTrigger id="unit">
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
                        <Label htmlFor="shelf_life_days">Срок годности (дни)</Label>
                        <Input
                          id="shelf_life_days"
                          type="number"
                          min="0"
                          value={formData.shelf_life_days ?? ""}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            shelf_life_days: e.target.value ? parseInt(e.target.value) : null 
                          })}
                          placeholder="Необязательно"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="min_stock">Мин. остаток</Label>
                          <Input
                            id="min_stock"
                            type="number"
                            min="0"
                            value={formData.min_stock}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              min_stock: parseFloat(e.target.value) || 0 
                            })}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="order_quantity">Кол-во заказа</Label>
                          <Input
                            id="order_quantity"
                            type="number"
                            min="0"
                            value={formData.order_quantity}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              order_quantity: parseFloat(e.target.value) || 0 
                            })}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="active">Активна</Label>
                        <Switch
                          id="active"
                          checked={formData.active}
                          onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={handleCloseDialog}>
                        Отмена
                      </Button>
                      <Button type="submit">
                        {editingPosition ? "Обновить" : "Создать"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {sortedCategoryNames.map((category) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle>{category}</CardTitle>
                  <CardDescription>{groupedPositions[category].length} позиций</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Название</TableHead>
                        <TableHead>Единица</TableHead>
                        <TableHead>Мин. остаток</TableHead>
                        <TableHead>Заказ</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead className="text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedPositions[category].map((position) => (
                        <TableRow key={position.id}>
                          <TableCell className="font-medium">{position.name}</TableCell>
                          <TableCell>{position.unit}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              className="w-20 h-8 text-center"
                              value={position.min_stock}
                              onChange={(e) => handleInlineUpdate(
                                position.id, 
                                'min_stock', 
                                parseFloat(e.target.value) || 0
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              className="w-20 h-8 text-center"
                              value={position.order_quantity}
                              onChange={(e) => handleInlineUpdate(
                                position.id, 
                                'order_quantity', 
                                parseFloat(e.target.value) || 0
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={position.active}
                              onCheckedChange={(checked) => handleInlineUpdate(
                                position.id, 
                                'active', 
                                checked
                              )}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(position)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}

            {positions.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground mb-4">Позиции ещё не созданы</p>
                  <Button onClick={() => handleOpenDialog()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить первую позицию
                  </Button>
                </CardContent>
              </Card>
            )}
            {positions.length > 0 && hasSearch && filteredPositions.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground mb-4">Нет результатов по вашему запросу.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-6">
            <div className="flex justify-end">
              <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => handleOpenCategoryDialog()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить категорию
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleCategorySubmit}>
                    <DialogHeader>
                      <DialogTitle>{editingCategory ? "Редактировать категорию" : "Добавить категорию"}</DialogTitle>
                      <DialogDescription>
                        {editingCategory ? "Обновите название и настройки категории" : "Создайте новую категорию для позиций"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="cat-name">Название</Label>
                        <Input
                          id="cat-name"
                          value={categoryFormData.name}
                          onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                          placeholder="например, Напитки"
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="cat-order">Порядок сортировки</Label>
                        <Input
                          id="cat-order"
                          type="number"
                          min="0"
                          value={categoryFormData.sort_order}
                          onChange={(e) => setCategoryFormData({ 
                            ...categoryFormData, 
                            sort_order: parseInt(e.target.value) || 0 
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="cat-active">Активна</Label>
                        <Switch
                          id="cat-active"
                          checked={categoryFormData.active}
                          onCheckedChange={(checked) => setCategoryFormData({ ...categoryFormData, active: checked })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={handleCloseCategoryDialog}>
                        Отмена
                      </Button>
                      <Button type="submit">
                        {editingCategory ? "Обновить" : "Создать"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Категории</CardTitle>
                <CardDescription>Управление категориями позиций инвентаря</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Название</TableHead>
                      <TableHead>Порядок</TableHead>
                      <TableHead>Позиций</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => {
                      const positionsCount = positions.filter(p => p.category === category.name).length;
                      return (
                        <TableRow key={category.id}>
                          <TableCell className="font-medium">{category.name}</TableCell>
                          <TableCell>{category.sort_order}</TableCell>
                          <TableCell>{positionsCount}</TableCell>
                          <TableCell>
                            <span className={category.active ? "text-green-600" : "text-muted-foreground"}>
                              {category.active ? "Активна" : "Неактивна"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenCategoryDialog(category)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {categories.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground mb-4">Категории ещё не созданы</p>
                  <Button onClick={() => handleOpenCategoryDialog()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить первую категорию
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Positions;
