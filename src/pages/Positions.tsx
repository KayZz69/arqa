import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, ArrowLeft, Tags } from "lucide-react";
import { z } from "zod";
import { filterItemsByQuery } from "@/lib/search";
import { PositionFormDialog } from "@/components/positions/PositionFormDialog";
import { CategoryFormDialog } from "@/components/positions/CategoryFormDialog";
import { PositionCategoryGroup } from "@/components/positions/PositionCategoryGroup";
import { CategoriesTab } from "@/components/positions/CategoriesTab";

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
    setPositions(prev => prev.map(p =>
      p.id === positionId ? { ...p, [field]: value } : p
    ));

    const timeoutKey = `${positionId}-${field}`;
    if (updateTimeouts.current[timeoutKey]) {
      clearTimeout(updateTimeouts.current[timeoutKey]);
    }

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

  if (loading || categoriesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  const activeCategories = categories.filter(c => c.active);
  const hasSearch = positionSearch.trim().length > 0;

  const groupedPositions = filteredPositions.reduce((acc, position) => {
    if (!acc[position.category]) {
      acc[position.category] = [];
    }
    acc[position.category].push(position);
    return acc;
  }, {} as Record<string, Position[]>);

  const sortedCategoryNames = Object.keys(groupedPositions).sort((a, b) => {
    const catA = categories.find(c => c.name === a);
    const catB = categories.find(c => c.name === b);
    return (catA?.sort_order ?? 999) - (catB?.sort_order ?? 999);
  });

  const positionsCountByCategory = positions.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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

          <TabsContent value="positions" className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Input
                value={positionSearch}
                onChange={(e) => setPositionSearch(e.target.value)}
                placeholder="Поиск позиций"
                className="sm:max-w-xs"
              />
              <PositionFormDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                editingPosition={editingPosition}
                formData={formData}
                onFormDataChange={setFormData}
                activeCategories={activeCategories}
                onSubmit={handleSubmit}
                onClose={handleCloseDialog}
                onOpenNew={() => handleOpenDialog()}
              />
            </div>

            {sortedCategoryNames.map((category) => (
              <PositionCategoryGroup
                key={category}
                category={category}
                positions={groupedPositions[category]}
                onInlineUpdate={handleInlineUpdate}
                onEditPosition={handleOpenDialog}
              />
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

          <TabsContent value="categories" className="space-y-6">
            <div className="flex justify-end">
              <CategoryFormDialog
                open={categoryDialogOpen}
                onOpenChange={setCategoryDialogOpen}
                editingCategory={editingCategory}
                formData={categoryFormData}
                onFormDataChange={setCategoryFormData}
                onSubmit={handleCategorySubmit}
                onClose={handleCloseCategoryDialog}
                onOpenNew={() => handleOpenCategoryDialog()}
              />
            </div>

            <CategoriesTab
              categories={categories}
              positionsCountByCategory={positionsCountByCategory}
              onEditCategory={handleOpenCategoryDialog}
              onAddCategory={() => handleOpenCategoryDialog()}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Positions;
