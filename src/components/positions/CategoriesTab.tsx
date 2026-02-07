import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Plus } from "lucide-react";

type Category = {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
  created_at: string;
};

interface CategoriesTabProps {
  categories: Category[];
  positionsCountByCategory: Record<string, number>;
  onEditCategory: (category: Category) => void;
  onAddCategory: () => void;
}

export function CategoriesTab({
  categories,
  positionsCountByCategory,
  onEditCategory,
  onAddCategory,
}: CategoriesTabProps) {
  return (
    <>
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
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell>{category.sort_order}</TableCell>
                  <TableCell>{positionsCountByCategory[category.name] || 0}</TableCell>
                  <TableCell>
                    <span className={category.active ? "text-green-600" : "text-muted-foreground"}>
                      {category.active ? "Активна" : "Неактивна"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEditCategory(category)}
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

      {categories.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-muted-foreground mb-4">Категории ещё не созданы</p>
            <Button onClick={onAddCategory}>
              <Plus className="mr-2 h-4 w-4" />
              Добавить первую категорию
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
