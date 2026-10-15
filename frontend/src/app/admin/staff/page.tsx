'use client';

import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import { apiClient } from '@/services/api/client';
import { useAuth } from '@/context/AuthContext';
import { ADMIN_PERMISSIONS } from '@/utils/adminPermissions';

interface StaffUser {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  is_super_admin: boolean;
  is_active: boolean;
  role_preset?: string | null;
  permissions: string[];
  must_change_password: boolean;
  created_at?: string;
  updated_at?: string;
}

interface RolePreset {
  id: number;
  name: string;
  slug: string;
  description?: string;
  permissions: string[];
  is_system: boolean;
}

interface AuditLog {
  id: number;
  actor_name: string;
  actor_email: string;
  affected_user_name?: string | null;
  affected_user_email?: string | null;
  action: string;
  details?: any;
  ip_address?: string | null;
  created_at: string;
}

export default function StaffManagementPage() {
  const { user: currentUser } = useAuth();

  // Active Tab: 'staff' | 'presets' | 'audit'
  const [activeTab, setActiveTab] = useState<'staff' | 'presets' | 'audit'>('staff');

  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [presets, setPresets] = useState<RolePreset[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search & Filter for Staff
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [presetFilter, setPresetFilter] = useState<string>('all');

  // Search & Filter for Audit Logs
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');

  // Staff Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);

  // Staff Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRolePreset, setFormRolePreset] = useState<string>('custom');
  const [formIsSuperAdmin, setFormIsSuperAdmin] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formMustChangePassword, setFormMustChangePassword] = useState(true);
  const [formSelectedPermissions, setFormSelectedPermissions] = useState<string[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Preset Modal State
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [presetModalMode, setPresetModalMode] = useState<'create' | 'edit'>('create');
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [presetFormName, setPresetFormName] = useState('');
  const [presetFormDescription, setPresetFormDescription] = useState('');
  const [presetFormPermissions, setPresetFormPermissions] = useState<string[]>([]);
  const [presetFormSubmitting, setPresetFormSubmitting] = useState(false);
  const [presetFormError, setPresetFormError] = useState('');

  // Delete Confirm Modal State
  const [deleteTargetUser, setDeleteTargetUser] = useState<StaffUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Delete Preset Confirm State
  const [deleteTargetPreset, setDeleteTargetPreset] = useState<RolePreset | null>(null);
  const [deletePresetLoading, setDeletePresetLoading] = useState(false);

  // Fetch Staff and Presets
  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [staffRes, presetsRes] = await Promise.all([
        apiClient.get('/admin/staff'),
        apiClient.get('/admin/staff/presets'),
      ]);

      if (staffRes.data?.success) {
        setStaffList(staffRes.data.data || []);
      }
      if (presetsRes.data?.success) {
        setPresets(presetsRes.data.data || []);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load staff list.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch Audit Logs
  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const res = await apiClient.get('/admin/staff/audit-logs');
      if (res.data?.success) {
        setAuditLogs(res.data.data || []);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load audit logs.'
      );
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      void fetchAuditLogs();
    }
  }, [activeTab]);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((staff) => {
      const matchesSearch =
        staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
          ? staff.is_active
          : !staff.is_active;

      const matchesPreset =
        presetFilter === 'all'
          ? true
          : staff.role_preset === presetFilter || (presetFilter === 'super_admin' && staff.is_super_admin);

      return matchesSearch && matchesStatus && matchesPreset;
    });
  }, [staffList, searchQuery, statusFilter, presetFilter]);

  // Filtered audit logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchesAction =
        auditActionFilter === 'all' ? true : log.action === auditActionFilter;

      const q = auditSearchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        log.actor_name?.toLowerCase().includes(q) ||
        log.actor_email?.toLowerCase().includes(q) ||
        log.affected_user_name?.toLowerCase().includes(q) ||
        log.affected_user_email?.toLowerCase().includes(q) ||
        log.action?.toLowerCase().includes(q);

      return matchesAction && matchesSearch;
    });
  }, [auditLogs, auditActionFilter, auditSearchQuery]);

  // Open Create Staff Modal
  const openCreateModal = () => {
    setModalMode('create');
    setSelectedStaffId(null);
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormPassword('');
    setFormRolePreset('designer');
    setFormIsSuperAdmin(false);
    setFormIsActive(true);
    setFormMustChangePassword(true);
    setFormError('');

    const designerPreset = presets.find((p) => p.slug === 'designer');
    setFormSelectedPermissions(
      designerPreset ? [...designerPreset.permissions] : ['templates', 'design_assets', 'artwork']
    );

    setIsModalOpen(true);
  };

  // Open Edit Staff Modal
  const openEditModal = (staff: StaffUser) => {
    setModalMode('edit');
    setSelectedStaffId(staff.id);
    setFormName(staff.name);
    setFormEmail(staff.email);
    setFormPhone(staff.phone || '');
    setFormPassword('');
    setFormRolePreset(staff.role_preset || (staff.is_super_admin ? 'administrator' : 'custom'));
    setFormIsSuperAdmin(staff.is_super_admin);
    setFormIsActive(staff.is_active);
    setFormMustChangePassword(staff.must_change_password);
    setFormSelectedPermissions([...staff.permissions]);
    setFormError('');
    setIsModalOpen(true);
  };

  // Handle Preset Change in Staff Form
  const handlePresetChange = (presetSlug: string) => {
    setFormRolePreset(presetSlug);

    if (presetSlug === 'administrator') {
      setFormSelectedPermissions(ADMIN_PERMISSIONS.map((p) => p.key));
      return;
    }

    const matchedPreset = presets.find((p) => p.slug === presetSlug);
    if (matchedPreset) {
      setFormSelectedPermissions([...matchedPreset.permissions]);
    }
  };

  // Toggle Single Permission in Staff Form
  const handleTogglePermission = (key: string) => {
    setFormSelectedPermissions((prev) => {
      const exists = prev.includes(key);
      const next = exists ? prev.filter((k) => k !== key) : [...prev, key];

      const matchingPreset = presets.find(
        (p) =>
          p.permissions.length === next.length &&
          p.permissions.every((pk) => next.includes(pk))
      );
      if (!matchingPreset && formRolePreset !== 'custom') {
        setFormRolePreset('custom');
      }

      return next;
    });
  };

  // Handle Staff Form Submission
  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim() || !formEmail.trim()) {
      setFormError('Name and email are required.');
      return;
    }

    if (modalMode === 'create' && formPassword.length < 8) {
      setFormError('Initial password is required and must be at least 8 characters.');
      return;
    }

    if (modalMode === 'edit' && formPassword && formPassword.length < 8) {
      setFormError('Updated password must be at least 8 characters.');
      return;
    }

    if (!formIsSuperAdmin && formSelectedPermissions.length === 0) {
      setFormError('Please select at least one permission or mark as Super Administrator.');
      return;
    }

    setFormSubmitting(true);

    const payload: any = {
      name: formName.trim(),
      email: formEmail.trim(),
      phone: formPhone.trim() || null,
      role_preset: formRolePreset,
      is_super_admin: formIsSuperAdmin,
      is_active: formIsActive,
      must_change_password: formMustChangePassword,
      permissions: formIsSuperAdmin
        ? ADMIN_PERMISSIONS.map((p) => p.key)
        : formSelectedPermissions,
    };

    if (formPassword) {
      payload.password = formPassword;
    }

    try {
      if (modalMode === 'create') {
        const res = await apiClient.post('/admin/staff', payload);
        if (res.data?.success) {
          setSuccess('Staff account created successfully.');
          setIsModalOpen(false);
          await fetchData();
        }
      } else {
        const res = await apiClient.put(`/admin/staff/${selectedStaffId}`, payload);
        if (res.data?.success) {
          setSuccess('Staff account updated successfully.');
          setIsModalOpen(false);
          await fetchData();
        }
      }
    } catch (err: any) {
      setFormError(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to save staff account.'
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  // Toggle Active/Inactive
  const handleToggleActive = async (staff: StaffUser) => {
    try {
      const res = await apiClient.patch(`/admin/staff/${staff.id}/toggle-active`);
      if (res.data?.success) {
        setSuccess(
          staff.is_active
            ? `Staff member ${staff.name} has been deactivated and active sessions revoked.`
            : `Staff member ${staff.name} has been activated.`
        );
        await fetchData();
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to update staff status.'
      );
    }
  };

  // Confirm Delete Staff
  const handleDeleteConfirm = async () => {
    if (!deleteTargetUser) return;
    setDeleteLoading(true);

    try {
      const res = await apiClient.delete(`/admin/staff/${deleteTargetUser.id}`);
      if (res.data?.success) {
        setSuccess(`Staff account "${deleteTargetUser.name}" was permanently removed.`);
        setDeleteTargetUser(null);
        await fetchData();
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to remove staff account.'
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  // Open Preset Create Modal
  const openCreatePresetModal = () => {
    setPresetModalMode('create');
    setSelectedPresetId(null);
    setPresetFormName('');
    setPresetFormDescription('');
    setPresetFormPermissions(['products', 'categories']);
    setPresetFormError('');
    setIsPresetModalOpen(true);
  };

  // Open Preset Edit Modal
  const openEditPresetModal = (preset: RolePreset) => {
    setPresetModalMode('edit');
    setSelectedPresetId(preset.id);
    setPresetFormName(preset.name);
    setPresetFormDescription(preset.description || '');
    setPresetFormPermissions([...preset.permissions]);
    setPresetFormError('');
    setIsPresetModalOpen(true);
  };

  // Handle Preset Form Submit
  const handlePresetFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPresetFormError('');

    if (!presetFormName.trim()) {
      setPresetFormError('Preset name is required.');
      return;
    }

    if (presetFormPermissions.length === 0) {
      setPresetFormError('Please select at least one permission for this preset.');
      return;
    }

    setPresetFormSubmitting(true);

    const payload = {
      name: presetFormName.trim(),
      description: presetFormDescription.trim() || null,
      permissions: presetFormPermissions,
    };

    try {
      if (presetModalMode === 'create') {
        const res = await apiClient.post('/admin/staff/presets', payload);
        if (res.data?.success) {
          setSuccess(`Role preset "${presetFormName}" created successfully.`);
          setIsPresetModalOpen(false);
          await fetchData();
        }
      } else {
        const res = await apiClient.put(`/admin/staff/presets/${selectedPresetId}`, payload);
        if (res.data?.success) {
          setSuccess(`Role preset "${presetFormName}" updated successfully.`);
          setIsPresetModalOpen(false);
          await fetchData();
        }
      }
    } catch (err: any) {
      setPresetFormError(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to save role preset.'
      );
    } finally {
      setPresetFormSubmitting(false);
    }
  };

  // Delete Preset Confirm
  const handleDeletePresetConfirm = async () => {
    if (!deleteTargetPreset) return;
    setDeletePresetLoading(true);

    try {
      const res = await apiClient.delete(`/admin/staff/presets/${deleteTargetPreset.id}`);
      if (res.data?.success) {
        setSuccess(`Custom role preset "${deleteTargetPreset.name}" was removed.`);
        setDeleteTargetPreset(null);
        await fetchData();
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to remove role preset.'
      );
    } finally {
      setDeletePresetLoading(false);
    }
  };

  // Grouped Permissions
  const permissionsByCategory = useMemo(() => {
    const grouped: Record<string, typeof ADMIN_PERMISSIONS> = {};
    for (const perm of ADMIN_PERMISSIONS) {
      if (!grouped[perm.category]) {
        grouped[perm.category] = [];
      }
      grouped[perm.category].push(perm);
    }
    return grouped;
  }, []);

  // Allowed vs Restricted Sections for Live Permission Summary / Preview
  const previewSummary = useMemo(() => {
    if (formIsSuperAdmin) {
      return {
        allowed: ADMIN_PERMISSIONS,
        restricted: [],
        count: ADMIN_PERMISSIONS.length,
        total: ADMIN_PERMISSIONS.length,
      };
    }
    const allowed = ADMIN_PERMISSIONS.filter((p) => formSelectedPermissions.includes(p.key));
    const restricted = ADMIN_PERMISSIONS.filter((p) => !formSelectedPermissions.includes(p.key));
    return {
      allowed,
      restricted,
      count: allowed.length,
      total: ADMIN_PERMISSIONS.length,
    };
  }, [formIsSuperAdmin, formSelectedPermissions]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Staff & Permissions
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              Super Admin Area
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage staff accounts, assign granular section permissions, customize role presets, and review security audit logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'presets' ? (
            <button
              onClick={openCreatePresetModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Create Role Preset</span>
            </button>
          ) : (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Staff User</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 font-bold text-xs">
            ✕
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-500 hover:text-emerald-700 font-bold text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('staff')}
          className={`flex items-center gap-2 pb-3 px-3 transition-colors border-b-2 ${
            activeTab === 'staff'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span>Staff Accounts ({staffList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('presets')}
          className={`flex items-center gap-2 pb-3 px-3 transition-colors border-b-2 ${
            activeTab === 'presets'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>Role Presets ({presets.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 pb-3 px-3 transition-colors border-b-2 ${
            activeTab === 'audit'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Security Audit Logs</span>
        </button>
      </div>

      {/* TAB 1: STAFF ACCOUNTS */}
      {activeTab === 'staff' && (
        <div className="space-y-6">
          {/* Overview Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Staff Accounts
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {staffList.length}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Active team members & admins</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
                Active Accounts
              </p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {staffList.filter((s) => s.is_active).length}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Granted access to admin area</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">
                Super Administrators
              </p>
              <p className="text-2xl font-bold text-amber-700 mt-1">
                {staffList.filter((s) => s.is_super_admin).length}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Full unrestricted system control</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">
                Configured Presets
              </p>
              <p className="text-2xl font-bold text-blue-700 mt-1">
                {presets.length}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">System & custom templates</p>
            </div>
          </div>

          {/* Filters and Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff by name or email..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setStatusFilter('active')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    statusFilter === 'active' ? 'bg-white text-emerald-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setStatusFilter('inactive')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    statusFilter === 'inactive' ? 'bg-white text-rose-700 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Deactivated
                </button>
              </div>

              <select
                value={presetFilter}
                onChange={(e) => setPresetFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Roles & Presets</option>
                <option value="super_admin">Super Admins</option>
                {presets.map((preset) => (
                  <option key={preset.slug} value={preset.slug}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Staff Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {loading ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-500">Loading staff records...</p>
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-700">No staff accounts found</p>
                <p className="text-xs text-slate-400">Try adjusting your search criteria or add a new staff user.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Role & Preset</th>
                      <th className="py-3 px-4">Allowed Sections</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStaff.map((staff) => {
                      const isCurrent = currentUser?.id === staff.id;
                      const isSuper = staff.is_super_admin;

                      return (
                        <tr key={staff.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 shadow-2xs ${
                                isSuper ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'
                              }`}>
                                {staff.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-slate-900 truncate">
                                    {staff.name}
                                  </span>
                                  {isCurrent && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                      You
                                    </span>
                                  )}
                                  {staff.must_change_password && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                      Password change pending
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400 block truncate">
                                  {staff.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {isSuper ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                Super Admin
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 capitalize">
                                {staff.role_preset?.replace('_', ' ') || 'Custom'}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {isSuper ? (
                              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                Full Unrestricted Access
                              </span>
                            ) : staff.permissions.length === 0 ? (
                              <span className="text-slate-400 italic text-xs">No sections granted</span>
                            ) : (
                              <div className="flex flex-wrap gap-1 max-w-md">
                                {staff.permissions.slice(0, 4).map((pKey) => {
                                  const pMeta = ADMIN_PERMISSIONS.find((p) => p.key === pKey);
                                  return (
                                    <span
                                      key={pKey}
                                      className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                                    >
                                      {pMeta?.name || pKey}
                                    </span>
                                  );
                                })}
                                {staff.permissions.length > 4 && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                                    +{staff.permissions.length - 4} more
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {staff.is_active ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                Deactivated
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => openEditModal(staff)}
                                className="px-2.5 py-1 rounded text-xs font-medium text-slate-700 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-colors"
                              >
                                Edit
                              </button>

                              <button
                                onClick={() => handleToggleActive(staff)}
                                className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                                  staff.is_active
                                    ? 'text-amber-700 hover:bg-amber-50 border-amber-200'
                                    : 'text-emerald-700 hover:bg-emerald-50 border-emerald-200'
                                }`}
                              >
                                {staff.is_active ? 'Deactivate' : 'Activate'}
                              </button>

                              <button
                                onClick={() => setDeleteTargetUser(staff)}
                                disabled={isCurrent}
                                className="px-2.5 py-1 rounded text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                title={isCurrent ? 'Cannot delete own account' : 'Delete user'}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ROLE PRESETS MANAGEMENT */}
      {activeTab === 'presets' && (
        <div className="space-y-6">
          <div className="bg-blue-50/60 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs text-blue-900 leading-relaxed space-y-1">
              <p className="font-semibold">Independent Preset Templates</p>
              <p>
                Role presets act as starting templates when adding staff. Selecting a preset pre-checks its permissions; you can customize individual permissions before saving. Modifying or adding presets here will <strong>never silently change</strong> permissions already assigned to existing users.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between space-y-4 hover:shadow-xs transition-shadow"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{preset.name}</h3>
                    {preset.is_system ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        System Built-in
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        Custom Preset
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed min-h-[36px]">
                    {preset.description || 'No description provided.'}
                  </p>

                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Included Sections ({preset.permissions.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {preset.permissions.map((pk) => {
                        const meta = ADMIN_PERMISSIONS.find((p) => p.key === pk);
                        return (
                          <span
                            key={pk}
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-700 border border-slate-200"
                          >
                            {meta?.name || pk}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    onClick={() => openEditPresetModal(preset)}
                    className="px-3 py-1 rounded text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-colors"
                  >
                    Edit Preset
                  </button>

                  {!preset.is_system && (
                    <button
                      onClick={() => setDeleteTargetPreset(preset)}
                      className="px-3 py-1 rounded text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {/* Audit Filters */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={auditSearchQuery}
                onChange={(e) => setAuditSearchQuery(e.target.value)}
                placeholder="Search audit events by user, actor, or action..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Recorded Actions</option>
                <option value="staff_created">Staff Created</option>
                <option value="staff_updated">Staff Updated</option>
                <option value="staff_deactivated">Staff Deactivated</option>
                <option value="staff_activated">Staff Activated</option>
                <option value="staff_deleted">Staff Deleted</option>
                <option value="preset_created">Preset Created</option>
                <option value="preset_updated">Preset Updated</option>
                <option value="preset_deleted">Preset Deleted</option>
              </select>

              <button
                onClick={fetchAuditLogs}
                disabled={auditLoading}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 text-slate-500 ${auditLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {auditLoading ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-500">Loading audit history...</p>
              </div>
            ) : filteredAuditLogs.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-700">No audit events found</p>
                <p className="text-xs text-slate-400">Administrative actions will automatically be recorded here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Actor</th>
                      <th className="py-3 px-4">Target User / Object</th>
                      <th className="py-3 px-4">Details Diff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAuditLogs.map((log) => {
                      const dateStr = new Date(log.created_at).toLocaleString('en-AU', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      });

                      const actionBadgeColors: Record<string, string> = {
                        staff_created: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                        staff_updated: 'bg-blue-50 text-blue-700 border-blue-200',
                        staff_deactivated: 'bg-amber-50 text-amber-700 border-amber-200',
                        staff_activated: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                        staff_deleted: 'bg-rose-50 text-rose-700 border-rose-200',
                        preset_created: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                        preset_updated: 'bg-sky-50 text-sky-700 border-sky-200',
                        preset_deleted: 'bg-rose-50 text-rose-700 border-rose-200',
                      };

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                            {dateStr}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border capitalize ${
                              actionBadgeColors[log.action] || 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {log.action.replace('_', ' ')}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-800">{log.actor_name}</p>
                            <p className="text-[10px] text-slate-400">{log.actor_email}</p>
                          </td>

                          <td className="py-3 px-4">
                            {log.affected_user_name || log.affected_user_email ? (
                              <div>
                                <p className="font-semibold text-slate-800">{log.affected_user_name}</p>
                                <p className="text-[10px] text-slate-400">{log.affected_user_email}</p>
                              </div>
                            ) : log.details?.preset_name ? (
                              <p className="font-semibold text-slate-800">{log.details.preset_name}</p>
                            ) : (
                              <span className="text-slate-400 italic">N/A</span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {log.details ? (
                              <div className="max-w-md space-y-1 text-[11px]">
                                {log.details.permissions_added?.length > 0 && (
                                  <div className="text-emerald-700">
                                    <strong>+ Added: </strong>
                                    {log.details.permissions_added.join(', ')}
                                  </div>
                                )}
                                {log.details.permissions_removed?.length > 0 && (
                                  <div className="text-rose-700">
                                    <strong>- Removed: </strong>
                                    {log.details.permissions_removed.join(', ')}
                                  </div>
                                )}
                                {log.details.preset_changed && (
                                  <div className="text-blue-700">
                                    <strong>Preset: </strong>
                                    {log.details.preset_changed.from || 'none'} → {log.details.preset_changed.to}
                                  </div>
                                )}
                                {log.details.tokens_revoked && (
                                  <div className="text-amber-700 font-semibold">
                                    Active tokens & sessions terminated immediately.
                                  </div>
                                )}
                                {log.details.permissions && (
                                  <div className="text-slate-600 truncate">
                                    <strong>Permissions: </strong>
                                    {Array.isArray(log.details.permissions) ? log.details.permissions.join(', ') : JSON.stringify(log.details.permissions)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">None</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE / EDIT STAFF MODAL (with live Permission Access Preview) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {modalMode === 'create' ? 'Create New Staff User' : `Edit Staff User: ${formName}`}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set account credentials, pick a preset, customize per-user permissions, and review the live access preview.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200/60 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {formError && (
                <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. Account Credentials */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">1</span>
                  Account Credentials
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Alex Henderson"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="alex@erryimprints.com.au"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Phone Number (optional)
                    </label>
                    <input
                      type="text"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="0400 000 000"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {modalMode === 'create' ? (
                        <>
                          Initial Password <span className="text-rose-500">*</span>
                        </>
                      ) : (
                        'Reset Password (leave blank to keep current)'
                      )}
                    </label>
                    <input
                      type="password"
                      required={modalMode === 'create'}
                      minLength={8}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder={modalMode === 'create' ? 'Min 8 characters' : 'Enter new password'}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={formMustChangePassword}
                      onChange={(e) => setFormMustChangePassword(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Require password change at first login</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Account is Active</span>
                  </label>
                </div>
              </div>

              {/* 2. Role Preset & Super Admin Privilege */}
              <div className="space-y-4 pt-2 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">2</span>
                  Role Preset & Authority
                </h4>

                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="super_admin_toggle"
                    checked={formIsSuperAdmin}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormIsSuperAdmin(checked);
                      if (checked) {
                        setFormSelectedPermissions(ADMIN_PERMISSIONS.map((p) => p.key));
                        setFormRolePreset('administrator');
                      }
                    }}
                    className="mt-0.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <label htmlFor="super_admin_toggle" className="text-xs font-bold text-amber-900 cursor-pointer">
                      Super Administrator Privileges
                    </label>
                    <p className="text-[11px] text-amber-700 leading-relaxed mt-0.5">
                      Grant full, unrestricted access to all current and future operational, financial, and catalog modules, including managing staff permissions.
                    </p>
                  </div>
                </div>

                {!formIsSuperAdmin && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Select Role Preset Template (Prefills Checkboxes)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {presets.map((preset) => {
                        const isSelected = formRolePreset === preset.slug;

                        return (
                          <button
                            key={preset.slug}
                            type="button"
                            onClick={() => handlePresetChange(preset.slug)}
                            className={`p-2.5 rounded-lg border text-left transition-all ${
                              isSelected
                                ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 text-blue-900'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <p className="text-xs font-bold">{preset.name}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                              {preset.description || `${preset.permissions.length} sections`}
                            </p>
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => setFormRolePreset('custom')}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          formRolePreset === 'custom'
                            ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 text-blue-900'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-xs font-bold">Custom</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Tailor exact permissions below
                        </p>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Granular Permission Checkboxes */}
              <div className="space-y-4 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">3</span>
                      Section Permissions Checklist
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Check each admin section this user is permitted to view and manage.
                    </p>
                  </div>

                  {!formIsSuperAdmin && (
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setFormSelectedPermissions(ADMIN_PERMISSIONS.map((p) => p.key));
                          setFormRolePreset('administrator');
                        }}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormSelectedPermissions([]);
                          setFormRolePreset('custom');
                        }}
                        className="text-slate-500 hover:text-slate-700 font-medium"
                      >
                        Deselect All
                      </button>
                    </div>
                  )}
                </div>

                {formIsSuperAdmin ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                    <p className="font-semibold text-slate-900">All permissions active</p>
                    <p className="text-[11px] text-slate-500">
                      Super Administrator accounts automatically have full access to all sections. Individual checkboxes are not required.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(permissionsByCategory).map(([category, items]) => (
                      <div key={category} className="space-y-2">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          {category} Modules
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {items.map((perm) => {
                            const isChecked = formSelectedPermissions.includes(perm.key);

                            return (
                              <label
                                key={perm.key}
                                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer select-none transition-colors ${
                                  isChecked
                                    ? 'bg-blue-50/60 border-blue-200 text-slate-900'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleTogglePermission(perm.key)}
                                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-slate-900 leading-tight">
                                    {perm.name}
                                  </p>
                                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                    {perm.description}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. LIVE PERMISSION SUMMARY & ACCESS PREVIEW */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px]">✓</span>
                    Live Access Summary & Preview
                  </h4>
                  <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {previewSummary.count} of {previewSummary.total} Sections Enabled
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                  {/* Allowed Sections */}
                  <div>
                    <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Sections User Can Access ({previewSummary.allowed.length}):
                    </p>
                    {previewSummary.allowed.length === 0 ? (
                      <p className="text-slate-400 italic text-[11px]">No sections enabled.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {previewSummary.allowed.map((p) => (
                          <span
                            key={p.key}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200"
                          >
                            <span>✓</span>
                            <span>{p.name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Restricted Sections */}
                  {!formIsSuperAdmin && previewSummary.restricted.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/60">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-slate-300" />
                        Restricted / Hidden Sections ({previewSummary.restricted.length}):
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {previewSummary.restricted.map((p) => (
                          <span
                            key={p.key}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200 line-through"
                          >
                            <span>✕</span>
                            <span>{p.name}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
                >
                  {formSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{modalMode === 'create' ? 'Create Staff User' : 'Save Changes'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT PRESET MODAL */}
      {isPresetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {presetModalMode === 'create' ? 'Create Reusable Role Preset' : `Edit Preset: ${presetFormName}`}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure a reusable template that pre-fills permission checkboxes when creating staff.
                </p>
              </div>
              <button
                onClick={() => setIsPresetModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200/60 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePresetFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {presetFormError && (
                <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  {presetFormError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Preset Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={presetFormName}
                  onChange={(e) => setPresetFormName(e.target.value)}
                  placeholder="e.g. Inventory Clerk, Prepress Specialist"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={presetFormDescription}
                  onChange={(e) => setPresetFormDescription(e.target.value)}
                  placeholder="Brief description of the responsibilities for this role..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Included Sections Checklist ({presetFormPermissions.length})
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPresetFormPermissions(ADMIN_PERMISSIONS.map((p) => p.key))}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => setPresetFormPermissions([])}
                      className="text-slate-500 hover:text-slate-700 font-medium"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1 border border-slate-200 rounded-lg">
                  {ADMIN_PERMISSIONS.map((perm) => {
                    const isChecked = presetFormPermissions.includes(perm.key);

                    return (
                      <label
                        key={perm.key}
                        className={`flex items-center gap-2 p-2 rounded border cursor-pointer select-none text-xs ${
                          isChecked ? 'bg-blue-50 border-blue-200 text-blue-900 font-semibold' : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setPresetFormPermissions((prev) =>
                              prev.includes(perm.key)
                                ? prev.filter((k) => k !== perm.key)
                                : [...prev, perm.key]
                            );
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="truncate">{perm.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPresetModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={presetFormSubmitting}
                  className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
                >
                  {presetFormSubmitting ? 'Saving...' : presetModalMode === 'create' ? 'Create Preset' : 'Update Preset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE USER CONFIRMATION MODAL */}
      {deleteTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in duration-200">
            <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Remove Staff Account?
              </h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to remove <strong className="text-slate-900">{deleteTargetUser.name}</strong> ({deleteTargetUser.email})? This will immediately revoke their access tokens and delete their account.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTargetUser(null)}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm flex items-center gap-2"
              >
                {deleteLoading ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE PRESET CONFIRMATION MODAL */}
      {deleteTargetPreset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in duration-200">
            <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Delete Role Preset?
              </h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to delete the custom preset <strong className="text-slate-900">{deleteTargetPreset.name}</strong>? Existing users who used this preset will keep their current permissions intact.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTargetPreset(null)}
                disabled={deletePresetLoading}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePresetConfirm}
                disabled={deletePresetLoading}
                className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm flex items-center gap-2"
              >
                {deletePresetLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
