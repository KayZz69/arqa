import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Position {
  id: string;
  name: string;
  category: string;
  unit: string;
}

interface InventoryBatch {
  id: string;
  position_id: string;
  quantity: number;
  arrival_date: string;
  expiry_date: string;
  created_at: string;
  positions: Position;
}

export default function InventoryBatches() {
  const navigate = useNavigate();
  const { role, loading: roleLoading } = useUserRole();
  const [positions, setPositions] = useState<Position[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedPositionId, setSelectedPositionId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [arrivalDate, setArrivalDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  const [expiryDate, setExpiryDate] = useState<string>("");

  useEffect(() => {
    if (!roleLoading && role !== "manager") {
      navigate("/");
      return;
    }

    fetchData();
  }, [roleLoading, role, navigate]);

  const fetchData = async () => {
    try {
      // Fetch positions
      const { data: positionsData, error: positionsError } = await supabase
        .from("positions")
        .select("*")
        .eq("active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (positionsError) throw positionsError;
      setPositions(positionsData || []);

      // Fetch batches with position details
      const { data: batchesData, error: batchesError } = await supabase
        .from("inventory_batches")
        .select(
          `
          *,
          positions (
            id,
            name,
            category,
            unit
          )
        `
        )
        .order("arrival_date", { ascending: false });

      if (batchesError) throw batchesError;
      setBatches(batchesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPositionId || !quantity || !arrivalDate || !expiryDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("inventory_batches").insert({
        position_id: selectedPositionId,
        quantity: parseFloat(quantity),
        arrival_date: arrivalDate,
        expiry_date: expiryDate,
        created_by: user.id,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Batch added successfully",
      });

      // Reset form
      setSelectedPositionId("");
      setQuantity("");
      setArrivalDate(format(new Date(), "yyyy-MM-dd"));
      setExpiryDate("");

      // Refresh data
      fetchData();
    } catch (error) {
      console.error("Error adding batch:", error);
      toast({
        title: "Error",
        description: "Failed to add batch",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (batchId: string) => {
    if (!confirm("Are you sure you want to delete this batch?")) return;

    try {
      const { error } = await supabase
        .from("inventory_batches")
        .delete()
        .eq("id", batchId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Batch deleted successfully",
      });

      fetchData();
    } catch (error) {
      console.error("Error deleting batch:", error);
      toast({
        title: "Error",
        description: "Failed to delete batch",
        variant: "destructive",
      });
    }
  };

  if (roleLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (role !== "manager") {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Inventory Batch Management
            </h1>
            <p className="text-muted-foreground">
              Add and manage inventory batches
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Batch Form */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add New Batch
              </CardTitle>
              <CardDescription>
                Enter batch details to add to inventory
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="position">Position</Label>
                  <Select
                    value={selectedPositionId}
                    onValueChange={setSelectedPositionId}
                  >
                    <SelectTrigger id="position">
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      {positions.map((position) => (
                        <SelectItem key={position.id} value={position.id}>
                          {position.category} - {position.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Enter quantity"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="arrival">Arrival Date</Label>
                  <Input
                    id="arrival"
                    type="date"
                    value={arrivalDate}
                    onChange={(e) => setArrivalDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiry">Expiry Date</Label>
                  <Input
                    id="expiry"
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Adding..." : "Add Batch"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Batches List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Current Batches</CardTitle>
              <CardDescription>
                View and manage existing inventory batches
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Position</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Arrival</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground"
                        >
                          No batches found
                        </TableCell>
                      </TableRow>
                    ) : (
                      batches.map((batch) => (
                        <TableRow key={batch.id}>
                          <TableCell className="font-medium">
                            {batch.positions.name}
                          </TableCell>
                          <TableCell>{batch.positions.category}</TableCell>
                          <TableCell className="text-right">
                            {batch.quantity} {batch.positions.unit}
                          </TableCell>
                          <TableCell>
                            {format(new Date(batch.arrival_date), "dd.MM.yyyy")}
                          </TableCell>
                          <TableCell>
                            {format(new Date(batch.expiry_date), "dd.MM.yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(batch.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
