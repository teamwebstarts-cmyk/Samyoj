import { useEffect, useState } from 'react';
import { Building2, Plus, Trash2, Users } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import EmptyState from '../ui/EmptyState';
import LoadingState from '../ui/LoadingState';
import SectionCard from '../ui/SectionCard';
import SlideOver, { SlideOverFooter } from '../ui/SlideOver';
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
  const [saving, setSaving] = useState(false);
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await teamApi.departments.create(form);
      toastSuccess('Department created');
      setSlideOpen(false);
      setForm({ name: '', color: PRESET_COLORS[0] });
      load();
      onChanged?.();
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to create department'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dept: TeamDepartment) => {
    if (!confirm(`Delete "${dept.name}"? Members will be unassigned from this department.`)) return;
    try {
      await teamApi.departments.remove(dept.id);
      toastSuccess('Department deleted');
      load();
      onChanged?.();
    } catch {
      toastError('Failed to delete department');
    }
  };

  if (loading) return <LoadingState label="Loading departments..." />;

  return (
    <div className="space-y-5">
      <SectionCard
        title="Departments"
        subtitle="Organize agents into teams for routing and reporting"
        headerAction={
          canManage ? (
            <AppButton icon={<Plus size={16} />} onClick={() => setSlideOpen(true)}>
              Add department
            </AppButton>
          ) : undefined
        }
      >
        {departments.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No departments yet"
            description="Create departments like Sales, Support, or Billing to organize your team."
            action={
              canManage ? (
                <AppButton icon={<Plus size={16} />} onClick={() => setSlideOpen(true)}>
                  Create department
                </AppButton>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((dept) => (
              <div
                key={dept.id}
                className="group relative overflow-hidden rounded-2xl border border-theme-border/70 bg-theme-subtle/30 p-4 transition hover:border-whatsapp-500/30 hover:shadow-sm"
              >
                <div
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ backgroundColor: dept.color }}
                />
                <div className="flex items-start justify-between gap-2 pt-1">
                  <div>
                    <p className="font-bold text-theme-fg">{dept.name}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-[12px] text-theme-secondary">
                      <Users className="h-3.5 w-3.5" />
                      {dept.memberCount ?? 0} member{(dept.memberCount ?? 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleDelete(dept)}
                      className="rounded-lg p-1.5 text-theme-muted opacity-0 transition hover:bg-rose-500/10 hover:text-rose-600 group-hover:opacity-100"
                      aria-label={`Delete ${dept.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {canManage && (
        <SlideOver
          open={slideOpen}
          onClose={() => setSlideOpen(false)}
          title="New department"
          subtitle="Group agents for smarter handoffs and filters"
          footer={
            <SlideOverFooter
              onCancel={() => setSlideOpen(false)}
              submitLabel="Create department"
              loading={saving}
            />
          }
        >
          <form id="slideover-form" onSubmit={handleCreate} className="space-y-4">
            <AppInput
              id="dept-name"
              label="Department name"
              placeholder="e.g. Customer Support"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <div>
              <label className="mb-2 block text-[12px] font-bold text-theme-secondary">Color</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, color })}
                    className={`h-8 w-8 rounded-full ring-2 ring-offset-2 transition ${
                      form.color === color ? 'ring-whatsapp-500 scale-110' : 'ring-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Color ${color}`}
                  />
                ))}
              </div>
            </div>
          </form>
        </SlideOver>
      )}
    </div>
  );
}
