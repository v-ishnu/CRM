'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Save, User, Laptop, CreditCard } from 'lucide-react';
import Link from 'next/link';

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
    if (!formData.projectName || !formData.totalAmount) {
      setError('Project Name and Total Budget Amount are required.');
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
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link
          href="/dashboard/clients"
          className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-slate-200 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Client Onboarding Wizard</h1>
          <p className="text-slate-405 text-sm">Register a new client, link project parameters, and log initial advances.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/45 border border-red-500/20 text-red-300 rounded-xl text-sm leading-relaxed">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Client Profile */}
        <section className="bg-[#0d0d12]/60 border border-slate-850 p-6 rounded-2xl relative overflow-hidden">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2.5 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-200">1. Client Profile Details</h2>
              <p className="text-xs text-slate-500">Contact information and address attributes</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Client Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="clientName"
                required
                value={formData.clientName}
                onChange={handleChange}
                placeholder="Rahul Sharma"
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 text-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="rahul@example.com"
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 text-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Phone Number
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 text-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Company / Organization
              </label>
              <input
                type="text"
                name="company"
                value={formData.company}
                onChange={handleChange}
                placeholder="Sharma Tech Solutions"
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 text-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm transition-all"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Street Address
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Sector 62, Block C"
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 text-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">City</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Noida"
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 text-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">State</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="Uttar Pradesh"
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 text-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Country</label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 text-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Onboarding Date
              </label>
              <input
                type="date"
                name="onboardingDate"
                value={formData.onboardingDate}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 text-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm transition-all cursor-pointer"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notes</label>
              <textarea
                name="clientNotes"
                rows={3}
                value={formData.clientNotes}
                onChange={handleChange}
                placeholder="Write any onboarding specifications here..."
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 text-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm transition-all"
              />
            </div>
          </div>
        </section>

        {/* Step 2: Project Parameters */}
        <section className="bg-[#0d0d12]/60 border border-slate-850 p-6 rounded-2xl relative overflow-hidden">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2.5 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-200">2. Project Specifications</h2>
              <p className="text-xs text-slate-500">Service attributes, budget configurations, and delivery milestones</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="projectName"
                required
                value={formData.projectName}
                onChange={handleChange}
                placeholder="Business Website Development"
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 text-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Service Type
              </label>
              <select
                name="serviceType"
                value={formData.serviceType}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 text-slate-350 rounded-xl outline-none focus:border-indigo-500 text-sm transition-all cursor-pointer"
              >
                <option value="WEBSITE">Website Development</option>
                <option value="WEB_APPLICATION">Web Application</option>
                <option value="MOBILE_APPLICATION">Mobile Application</option>
                <option value="API_DEVELOPMENT">API Development</option>
                <option value="WORDPRESS">WordPress Site</option>
                <option value="ECOMMERCE">E-Commerce Development</option>
                <option value="MAINTENANCE">System Maintenance</option>
                <option value="OTHER">Other Tech Service</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Curr</label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 bg-slate-950/60 border border-slate-800 text-slate-350 rounded-xl outline-none focus:border-indigo-500 text-sm transition-all cursor-pointer"
                >
                  <option value="INR">₹ INR</option>
                  <option value="USD">$ USD</option>
                  <option value="EUR">€ EUR</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Total Budget Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="totalAmount"
                  required
                  value={formData.totalAmount}
                  onChange={handleChange}
                  placeholder="50000"
                  className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 text-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Project Start Date
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 text-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm transition-all cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Expected Completion Date
              </label>
              <input
                type="date"
                name="expectedCompletionDate"
                value={formData.expectedCompletionDate}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 text-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm transition-all cursor-pointer"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Project Scope / Deliverables
              </label>
              <textarea
                name="projectDescription"
                rows={3}
                value={formData.projectDescription}
                onChange={handleChange}
                placeholder="Briefly state key project goals, features, or stack details..."
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 text-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm transition-all"
              />
            </div>
          </div>
        </section>

        {/* Step 3: Record Advance Payment (Optional) */}
        <section className="bg-[#0d0d12]/60 border border-slate-850 p-6 rounded-2xl relative overflow-hidden">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2.5 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-200">3. Log Advance Payment (Optional)</h2>
              <p className="text-xs text-slate-500">Record any upfront payments to credit client balance</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Advance Payment Amount (Leave empty if none)
              </label>
              <input
                type="number"
                name="paymentAmount"
                value={formData.paymentAmount}
                onChange={handleChange}
                placeholder="25000"
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 text-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Payment Method
              </label>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 text-slate-350 rounded-xl outline-none focus:border-indigo-500 text-sm transition-all cursor-pointer"
              >
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                <option value="CASH">Cash Payment</option>
                <option value="RAZORPAY">Razorpay Gateway</option>
                <option value="STRIPE">Stripe Link</option>
                <option value="OTHER">Other Method</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Payment Received Date
              </label>
              <input
                type="date"
                name="paymentDate"
                value={formData.paymentDate}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 text-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm transition-all cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Transaction Reference ID
              </label>
              <input
                type="text"
                name="transactionReference"
                value={formData.transactionReference}
                onChange={handleChange}
                placeholder="TXN-98239012"
                className="w-full px-4 py-2.5 bg-slate-950/60 border border-slate-800 text-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm transition-all"
              />
            </div>
          </div>
        </section>

        {/* Submit Actions */}
        <div className="flex gap-4 items-center justify-end">
          <Link
            href="/dashboard/clients"
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-sm font-semibold transition-all"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center px-8 py-3 bg-indigo-650 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-55 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/15"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Processing Onboarding...
              </>
            ) : (
              <>
                <Save className="w-4.5 h-4.5 mr-2" />
                Complete Onboarding
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
