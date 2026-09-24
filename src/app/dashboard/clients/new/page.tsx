'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Save, User, Laptop, CreditCard, Terminal } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    // Client Profile
    clientName: '',
    email: '',
    phone: '',
    company: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    clientStatus: 'ACTIVE',
    clientNotes: '',
    onboardingDate: new Date().toISOString().split('T')[0],

    // Project Details
    projectName: '',
    serviceType: 'WEBSITE',
    projectDescription: '',
    totalAmount: '',
    currency: 'INR',
    startDate: new Date().toISOString().split('T')[0],
    expectedCompletionDate: '',

    // Payment Details (Optional)
    paymentAmount: '',
    paymentMethod: 'BANK_TRANSFER',
    paymentDate: new Date().toISOString().split('T')[0],
    transactionReference: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validate essential inputs
    if (!formData.clientName || !formData.email) {
      setError('Client Name and Email are required.');
      setLoading(false);
      return;
    }
    if (formData.projectName && !formData.totalAmount) {
      setError('Total Budget Amount is required when creating a project.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error?.message || 'Onboarding failed. Please try again.');
      } else {
        router.push(`/dashboard/clients/${data.data.client._id}`);
        router.refresh();
      }
    } catch (err: any) {
      console.error(err);
      setError('An unexpected server error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans selection:bg-[#ff3e00] selection:text-white">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/clients"
          className="p-2 bg-[#141416] hover:bg-[#18181b] border border-[#242428] hover:border-[#ff3e00] text-[#8a8a93] hover:text-white transition-colors"
          title="Back to Clients"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-[#ff3e00]">
              CLIENTS // ONBOARDING WIZARD
            </span>
            <span className="text-[#3f3f46]">/</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#8a8a93]">
              REGISTRATION
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Client Onboarding Wizard
          </h1>
          <p className="text-xs text-[#8a8a93] mt-0.5">
            Register a new client profile, configure project deliverables, and post initial retainer telemetry.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-[#1c1110] border border-[#ff3e00]/40 text-[#ff8a7a] text-xs font-mono flex items-start gap-2.5">
          <span className="text-[#ff3e00] font-bold">ERR:</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Client Profile */}
        <section className="bg-[#141416] border border-[#242428] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#242428] pb-3">
            <div className="flex items-center space-x-2.5">
              <User className="w-4 h-4 text-[#ff3e00]" />
              <h2 className="text-xs font-mono font-semibold text-white uppercase tracking-wider">
                01 // CLIENT PROFILE ATTRIBUTES
              </h2>
            </div>
            <span className="text-[10px] font-mono text-[#8a8a93]">* REQUIRED FIELDS</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                Client Legal Name <span className="text-[#ff3e00]">*</span>
              </label>
              <input
                type="text"
                name="clientName"
                required
                value={formData.clientName}
                onChange={handleChange}
                placeholder="e.g. Rahul Sharma"
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] placeholder-[#4a4a52] focus:outline-none focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                Email Address <span className="text-[#ff3e00]">*</span>
              </label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="client@domain.com"
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] placeholder-[#4a4a52] focus:outline-none focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                Phone / WhatsApp Number
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] placeholder-[#4a4a52] focus:outline-none focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                Company / Organization
              </label>
              <input
                type="text"
                name="company"
                value={formData.company}
                onChange={handleChange}
                placeholder="Sharma Tech Solutions"
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] placeholder-[#4a4a52] focus:outline-none focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00] transition-colors"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                Street Address
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Sector 62, Block C"
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] placeholder-[#4a4a52] focus:outline-none focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">City</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Noida"
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] placeholder-[#4a4a52] focus:outline-none focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">State / Province</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="Uttar Pradesh"
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] placeholder-[#4a4a52] focus:outline-none focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">Country</label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] placeholder-[#4a4a52] focus:outline-none focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                Onboarding Date
              </label>
              <input
                type="date"
                name="onboardingDate"
                value={formData.onboardingDate}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] font-mono focus:outline-none focus:border-[#ff3e00] cursor-pointer"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">Client Notes</label>
              <textarea
                name="clientNotes"
                rows={2}
                value={formData.clientNotes}
                onChange={handleChange}
                placeholder="Add special client specifications or billing requirements..."
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] placeholder-[#4a4a52] focus:outline-none focus:border-[#ff3e00] transition-colors"
              />
            </div>
          </div>
        </section>

        {/* Step 2: Project Specifications */}
        <section className="bg-[#141416] border border-[#242428] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#242428] pb-3">
            <div className="flex items-center space-x-2.5">
              <Laptop className="w-4 h-4 text-[#ff3e00]" />
              <h2 className="text-xs font-mono font-semibold text-white uppercase tracking-wider">
                02 // INITIAL PROJECT PARAMETERS
              </h2>
            </div>
            <span className="text-[10px] font-mono text-[#8a8a93]">SCOPE & DELIVERABLES</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                Project Name <span className="text-[#ff3e00]">*</span>
              </label>
              <input
                type="text"
                name="projectName"
                required
                value={formData.projectName}
                onChange={handleChange}
                placeholder="e.g. Enterprise CRM Architecture"
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] placeholder-[#4a4a52] focus:outline-none focus:border-[#ff3e00] focus:ring-1 focus:ring-[#ff3e00] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                Service Category
              </label>
              <select
                name="serviceType"
                value={formData.serviceType}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] font-mono focus:outline-none focus:border-[#ff3e00] cursor-pointer"
              >
                <option value="WEBSITE">WEBSITE DEVELOPMENT</option>
                <option value="WEB_APPLICATION">WEB APPLICATION</option>
                <option value="MOBILE_APPLICATION">MOBILE APPLICATION</option>
                <option value="API_DEVELOPMENT">API DEVELOPMENT</option>
                <option value="WORDPRESS">WORDPRESS SITE</option>
                <option value="ECOMMERCE">ECOMMERCE PLATFORM</option>
                <option value="MAINTENANCE">SYSTEM MAINTENANCE</option>
                <option value="OTHER">OTHER TECHNICAL SERVICE</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">CURR</label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className="w-full px-2 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] font-mono focus:outline-none focus:border-[#ff3e00] cursor-pointer"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                  Total Budget <span className="text-[#ff3e00]">*</span>
                </label>
                <input
                  type="number"
                  name="totalAmount"
                  required
                  value={formData.totalAmount}
                  onChange={handleChange}
                  placeholder="50000"
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-white font-mono font-bold focus:outline-none focus:border-[#ff3e00]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                Target Start Date
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] font-mono focus:outline-none focus:border-[#ff3e00] cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                Target Completion Date
              </label>
              <input
                type="date"
                name="expectedCompletionDate"
                value={formData.expectedCompletionDate}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] font-mono focus:outline-none focus:border-[#ff3e00] cursor-pointer"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                Project Scope & Deliverable Notes
              </label>
              <textarea
                name="projectDescription"
                rows={2}
                value={formData.projectDescription}
                onChange={handleChange}
                placeholder="Summary of stack, core feature milestones, and deliverables..."
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] placeholder-[#4a4a52] focus:outline-none focus:border-[#ff3e00] transition-colors"
              />
            </div>
          </div>
        </section>

        {/* Step 3: Record Advance Payment (Optional) */}
        <section className="bg-[#141416] border border-[#242428] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#242428] pb-3">
            <div className="flex items-center space-x-2.5">
              <CreditCard className="w-4 h-4 text-[#ff3e00]" />
              <h2 className="text-xs font-mono font-semibold text-white uppercase tracking-wider">
                03 // ADVANCE SETTLEMENT (OPTIONAL)
              </h2>
            </div>
            <span className="text-[10px] font-mono text-[#00d664]">RETAINER / ADVANCE</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                Advance Amount (Leave blank if pending)
              </label>
              <input
                type="number"
                name="paymentAmount"
                value={formData.paymentAmount}
                onChange={handleChange}
                placeholder="25000"
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-white font-mono font-bold focus:outline-none focus:border-[#ff3e00]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                Payment Channel
              </label>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] font-mono focus:outline-none focus:border-[#ff3e00] cursor-pointer"
              >
                <option value="BANK_TRANSFER">BANK TRANSFER (IMPS/NEFT/RTGS)</option>
                <option value="UPI">UPI (GPAY / PHONEPE / QR)</option>
                <option value="CASH">CASH TRANSACTION</option>
                <option value="RAZORPAY">RAZORPAY GATEWAY</option>
                <option value="STRIPE">STRIPE INVOICE</option>
                <option value="OTHER">OTHER METHOD</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                Receipt Date
              </label>
              <input
                type="date"
                name="paymentDate"
                value={formData.paymentDate}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] font-mono focus:outline-none focus:border-[#ff3e00] cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono font-semibold text-[#8a8a93] uppercase tracking-wider mb-1.5">
                Transaction Reference / UTR
              </label>
              <input
                type="text"
                name="transactionReference"
                value={formData.transactionReference}
                onChange={handleChange}
                placeholder="TXN-98239012"
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#242428] text-xs text-[#f5f5f2] font-mono focus:outline-none focus:border-[#ff3e00]"
              />
            </div>
          </div>
        </section>

        {/* Submit Actions */}
        <div className="flex gap-3 items-center justify-end pt-2">
          <Link
            href="/dashboard/clients"
            className="px-5 py-2.5 bg-[#0a0a0a] hover:bg-[#18181b] border border-[#242428] text-[#8a8a93] hover:text-white font-mono text-xs font-semibold uppercase tracking-wider transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white text-black hover:bg-[#ff3e00] hover:text-white font-mono text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer shadow-lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                REGISTERING CLIENT DATA...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                COMPLETE CLIENT ONBOARDING
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
