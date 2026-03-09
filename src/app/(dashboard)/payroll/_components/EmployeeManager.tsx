"use client";

import { useState, useEffect } from "react";
import {
  getEmployees,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  Employee,
} from "@/services/employees.firebase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import InputMoney from "@/components/InputMoney";
import { Trash2, UserPlus, Users, Pencil, Save, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default function EmployeeManager({ storeId }: { storeId: string }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Phục vụ");
  const [hourlyRate, setHourlyRate] = useState(0);
  const [loading, setLoading] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editHourlyRate, setEditHourlyRate] = useState(0);

  useEffect(() => {
    loadEmployees();
  }, [storeId]);

  async function loadEmployees() {
    if (!storeId) return;
    const data = await getEmployees(storeId);
    setEmployees(data);
  }

  async function handleAdd() {
    if (!name || !hourlyRate) {
      alert("Vui lòng nhập tên và mức lương");
      return;
    }
    setLoading(true);
    try {
      await addEmployee({ storeId, name, role, hourlyRate });
      setName("");
      setHourlyRate(0);
      await loadEmployees();
    } catch (error) {
      console.error(error);
      alert("Lỗi khi thêm nhân viên");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bạn có chắc muốn xóa nhân viên này?")) return;
    try {
      await deleteEmployee(id);
      await loadEmployees();
    } catch (error) {
      console.error(error);
      alert("Lỗi khi xóa nhân viên");
    }
  }

  // Edit handlers
  const handleEdit = (emp: Employee) => {
    setEditingId(emp.id!);
    setEditName(emp.name);
    setEditRole(emp.role);
    setEditHourlyRate(emp.hourlyRate);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditRole("");
    setEditHourlyRate(0);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName || !editHourlyRate) return;
    try {
      await updateEmployee(editingId, {
        name: editName,
        role: editRole,
        hourlyRate: editHourlyRate,
      });
      setEditingId(null);
      await loadEmployees();
    } catch (error) {
      console.error(error);
      alert("Lỗi khi cập nhật nhân viên");
    }
  };

  const RoleSelect = ({ value, onChange, className }: any) => (
    <select className={className} value={value} onChange={onChange}>
      <optgroup label="Cafe">
        <option value="Phục vụ">Phục vụ</option>
        <option value="Pha chế">Pha chế</option>
        <option value="Thu ngân">Thu ngân</option>
      </optgroup>
      <optgroup label="Bếp">
        <option value="Bếp">Bếp</option>
        <option value="Thu ngân bếp">Thu ngân bếp</option>
        <option value="Phục vụ bếp">Phục vụ bếp</option>
        <option value="Rửa chén">Rửa chén</option>
      </optgroup>
      <optgroup label="Farm">
        <option value="Chăm sóc thú">Chăm sóc thú</option>
        <option value="Thú Y">Thú Y</option>
        <option value="Thu ngân farm">Thu ngân farm</option>
        <option value="Soát vé">Soát vé</option>
        <option value="Thời vụ">Thời vụ</option>
        <option value="Bán hàng">Bán hàng</option>
      </optgroup>
      <optgroup label="Chung">
        <option value="Leader">Leader</option>
        <option value="MKT">MKT</option>
      </optgroup>
    </select>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-1 h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="w-5 h-5 text-emerald-600" />
            Thêm nhân viên
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">
              Tên nhân viên
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Nguyen Van A"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Vai trò</label>
            <RoleSelect
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={role}
              onChange={(e: any) => setRole(e.target.value)}
            />
          </div>
          <InputMoney
            label="Lương theo giờ (VNĐ)"
            set={setHourlyRate}
            value={hourlyRate}
          />
          <Button
            onClick={handleAdd}
            disabled={loading}
            className="w-full gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Thêm mới
          </Button>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5 text-blue-600" />
            Danh sách nhân viên ({employees.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-500 w-[30%]">
                    Tên
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500 w-[20%]">
                    Vai trò
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500 w-[25%]">
                    Lương/giờ
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500 w-[25%]">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {employees.map((emp) => {
                  const isEditing = editingId === emp.id;

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium">
                        {isEditing ? (
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8"
                          />
                        ) : (
                          emp.name
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <RoleSelect
                            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                            value={editRole}
                            onChange={(e: any) => setEditRole(e.target.value)}
                          />
                        ) : (
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              emp.role === "Leader"
                                ? "bg-amber-100 text-amber-700"
                                : emp.role === "Manager"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {emp.role}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {isEditing ? (
                          <InputMoney
                            value={editHourlyRate}
                            set={setEditHourlyRate}
                            className="h-8 text-right"
                          />
                        ) : (
                          `${emp.hourlyRate?.toLocaleString()} ₫`
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleSaveEdit}
                                className="text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 h-8 w-8"
                                title="Lưu"
                              >
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleCancelEdit}
                                className="text-slate-500 hover:text-slate-700 hover:bg-slate-50 h-8 w-8"
                                title="Hủy"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(emp)}
                                className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 h-8 w-8"
                                title="Sửa"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(emp.id!)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                                title="Xóa"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {employees.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-slate-400"
                    >
                      Chưa có nhân viên nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
