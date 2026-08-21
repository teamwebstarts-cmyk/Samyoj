import { useEffect, useState } from 'react';
import { Building2, Pencil, Plus, Trash2, Users } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import ListLayoutSkeleton from '../ui/ListLayoutSkeleton';
import SlideOver, { SlideOverFooter } from '../ui/SlideOver';
import { ModalCallout, ModalPanel, ModalSection } from '../ui/modalUi';
import { teamApi } from '../../services/api';
import type { TeamDepartment } from '../../types';
import { toastError, toastSuccess } from '../../utils/toast';

const PRESET_COLORS = ['#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];

interface TeamDepartmentsTabProps {
  canManage: boolean;
  onChanged?: () => void;
}

export default function TeamDepartmentsTab({ canManage, onChanged }: TeamDepartmentsTabProps) {
  const [departments, setDepartments] = useState<TeamDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<TeamDepartment | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TeamDepartment | null>(null);
  const [form, setForm] = useState({ name: '', color: PRESET_COLORS[0] });

  const load = () => {
    setLoading(true);
    teamApi.departments
      .list()
      .then(({ data }) => setDepartments(data.data.departments))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setEditingDept(null);
    setForm({ name: '', color: PRESET_COLORS[0] });
    setSlideOpen(true);
  };

  const openEdit = (dept: TeamDepartment) => {
    setEditingDept(dept);
    setForm({ name: dept.name, color: dept.color || PRESET_COLORS[0] });
    setSlideOpen(true);
  };

  const closeSlide = () => {
    setSlideOpen(false);
    setEditingDept(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingDept) {
        await teamApi.departments.update(editingDept.id, form);
        toastSuccess('Department updated');
      } else {
        await teamApi.departments.create(form);
        toastSuccess('Department created');
      }
      closeSlide();
      load();
      onChanged?.();
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to save department'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await teamApi.departments.remove(deleteTarget.id);
      toastSuccess('Department deleted');
      setDeleteTarget(null);
      load();
      onChanged?.();
    } catch {
      toastError('Failed to delete department');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="inbox-shell overflow-hidden">
      {canManage && (
        <div className="flex items-center justify-end border-b border-theme-border px-4 py-3.5 sm:px-5">
          <AppButton size="sm" icon={<Plus size={15} />} onClick={openCreate}>
            Add department
          </AppButton>
        </div>
      )}

      {loading && departments.length === 0 ? (
        <ListLayoutSkeleton label="Loading departments" rows={6} tableHeaders={['Department', 'Members', 'Actions']} />
      ) : departments.length === 0 ? (
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={Building2}
            title="No departments yet"
            description="Group your team into departments like Sales, Support, or Billing."
            steps={['Tap Create department', 'Give it a name like "Support"', 'Assign team members to it']}
            action={
              canManage ? (
                <AppButton icon={<Plus size={16} />} onClick={openCreate}>
                  Create department
                </AppButton>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="overflow-hidden rounded-2xl border border-theme-border bg-theme-surface transition hover:shadow-md"
            >
              <div className="h-1.5" style={{ backgroundColor: dept.color }} />
              <div className="flex items-start justify-between gap-2 p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                    style={{ backgroundColor: dept.color }}
                  >
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold text-theme-fg">{dept.name}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-[12px] text-theme-secondary">
                      <Users className="h-3.5 w-3.5" />
                      {dept.memberCount ?? 0} member{(dept.memberCount ?? 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(dept)}
                      className="rounded-lg p-1.5 text-theme-muted transition hover:bg-theme-subtle hover:text-theme-fg"
                      aria-label={`Rename ${dept.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(dept)}
                      className="rounded-lg p-1.5 text-theme-muted transition hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                      aria-label={`Delete ${dept.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <SlideOver
          open={slideOpen}
          onClose={closeSlide}
          title={editingDept ? 'Edit department' : 'New department'}
          subtitle="Group agents for routing"
          icon={Building2}
          accent="violet"
          footer={
            <SlideOverFooter
              onCancel={closeSlide}
              submitLabel={editingDept ? 'Save changes' : 'Create department'}
              loading={saving}
            />
          }
        >
          <form id="slideover-form" onSubmit={handleCreate} className="space-y-5">
            <ModalCallout
              icon={Building2}
              accent="violet"
              title="Organize your team"
              description="Departments help route chats and filter members in Inbox and Reports."
            />

            <ModalSection step={1} title="Department details" subtitle="Name and color for quick recognition">
              <ModalPanel accent="violet">
                <div className="space-y-4">
                  <AppInput
                    id="dept-name"
                    label="Department name"
                    placeholder="e.g. Customer Support"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                  <div>
                    <label className="mb-2 block text-[12px] font-bold text-theme-secondary">
                      Color
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setForm({ ...form, color })}
                          className={`h-9 w-9 rounded-full ring-2 ring-offset-2 transition ${
                            form.color === color
                              ? 'scale-110 ring-whatsapp-500'
                              : 'ring-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: color }}
                          aria-label={`Color ${color}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </ModalPanel>
            </ModalSection>
          </form>
        </SlideOver>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title={`Delete "${deleteTarget?.name ?? 'department'}"?`}
        description="Members will be unassigned from this department."
        confirmLabel="Delete department"
        variant="danger"
        loading={saving}
      />
    </div>
  );
}
