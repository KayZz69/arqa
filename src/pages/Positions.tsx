import { useState, useEffect } from "react";
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
import { toast } from "sonner";
import { Plus, Pencil, ArrowLeft } from "lucide-react";
import { z } from "zod";

const CATEGORIES = ["Выпечка", "Кухня", "Ингредиент", "Расходник"] as const;
const UNITS = ["кг", "л", "шт", "г", "мл", "уп"] as const;

const positionSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  category: z.enum(CATEGORIES, { required_error: "Category is required" }),
  unit: z.enum(UNITS, { required_error: "Unit is required" }),
  shelf_life_days: z.number().int().min(0).nullable(),
  active: z.boolean(),
});

type Position = {
  id: string;
  name: string;
  category: string;
  unit: string;
  shelf_life_days: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type PositionForm = Omit<Position, "id" | "created_at" | "updated_at">;

const Positions = () => {
  const navigate = useNavigate();
  const { role, loading: roleLoading } = useUserRole();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [formData, setFormData] = useState<PositionForm>({
    name: "",
    category: "",
    unit: "",
    shelf_life_days: null,
    active: true,
  });

  useEffect(() => {
    if (!roleLoading && role !== "manager") {
      toast.error("Access denied. Manager role required.");
      navigate("/");
    }
  }, [role, roleLoading, navigate]);

  useEffect(() => {
    fetchPositions();
  }, []);

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
      toast.error("Failed to load positions");
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (position?: Position) => {
    if (position) {
      setEditingPosition(position);
      setFormData({
        name: position.name,
        category: position.category,
        unit: position.unit,
        shelf_life_days: position.shelf_life_days,
        active: position.active,
      });
    } else {
      setEditingPosition(null);
      setFormData({
        name: "",
        category: "",
        unit: "",
        shelf_life_days: null,
        active: true,
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
          })
          .eq("id", editingPosition.id);

        if (error) throw error;
        toast.success("Position updated successfully");
      } else {
        const { error } = await supabase
          .from("positions")
          .insert([{
            name: validatedData.name,
            category: validatedData.category,
            unit: validatedData.unit,
            shelf_life_days: validatedData.shelf_life_days,
            active: validatedData.active,
          }]);

        if (error) throw error;
        toast.success("Position created successfully");
      }

      handleCloseDialog();
      fetchPositions();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Failed to save position");
        console.error("Error:", error);
      }
    }
  };

  if (roleLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const groupedPositions = positions.reduce((acc, position) => {
    if (!acc[position.category]) {
      acc[position.category] = [];
    }
    acc[position.category].push(position);
    return acc;
  }, {} as Record<string, Position[]>);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Position Management</h1>
              <p className="text-muted-foreground">Manage inventory positions, categories, and settings</p>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Position
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingPosition ? "Edit Position" : "Add New Position"}</DialogTitle>
                  <DialogDescription>
                    {editingPosition ? "Update the position details" : "Create a new inventory position"}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Whole Milk"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select category" />
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
                    <Label htmlFor="unit">Unit</Label>
                    <Select
                      value={formData.unit}
                      onValueChange={(value) => setFormData({ ...formData, unit: value })}
                    >
                      <SelectTrigger id="unit">
                        <SelectValue placeholder="Select unit" />
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
                    <Label htmlFor="shelf_life_days">Shelf Life (days)</Label>
                    <Input
                      id="shelf_life_days"
                      type="number"
                      min="0"
                      value={formData.shelf_life_days ?? ""}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        shelf_life_days: e.target.value ? parseInt(e.target.value) : null 
                      })}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="active">Active</Label>
                    <Switch
                      id="active"
                      checked={formData.active}
                      onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingPosition ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {Object.entries(groupedPositions).map(([category, categoryPositions]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle>{category}</CardTitle>
              <CardDescription>{categoryPositions.length} position(s)</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Shelf Life</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryPositions.map((position) => (
                    <TableRow key={position.id}>
                      <TableCell className="font-medium">{position.name}</TableCell>
                      <TableCell>{position.unit}</TableCell>
                      <TableCell>
                        {position.shelf_life_days ? `${position.shelf_life_days} days` : "N/A"}
                      </TableCell>
                      <TableCell>
                        <span className={position.active ? "text-green-600" : "text-muted-foreground"}>
                          {position.active ? "Active" : "Inactive"}
                        </span>
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
              <p className="text-muted-foreground mb-4">No positions created yet</p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Add First Position
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Positions;