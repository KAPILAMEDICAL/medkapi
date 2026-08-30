'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';

export interface ProductFormValues {
  id?: string;
  name: string;
  companyId: string;
  divisionId?: string;
  categoryId?: string;
  composition?: string;
  packSize?: string;
  sku?: string;
  productCode?: string;
  mrp: string;
  ptr: string;
  pts: string;
  gstPercent: string;
  stockQty: string;
  minOrderQty: string;
  isFastMoving: boolean;
  isFeatured: boolean;
  isActive: boolean;
}

export function ProductForm({
  initial,
  companies,
  categories,
}: {
  initial: ProductFormValues;
  companies: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function set<K extends keyof ProductFormValues>(key: K, v: ProductFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function submit() {
    setError(null);
    setPending(true);
    try {
      const payload = {
        name: values.name,
        companyId: values.companyId,
        divisionId: values.divisionId || undefined,
        categoryId: values.categoryId || undefined,
        composition: values.composition || undefined,
        packSize: values.packSize || undefined,
        sku: values.sku || undefined,
        productCode: values.productCode || undefined,
        mrp: Number(values.mrp),
        ptr: values.ptr ? Number(values.ptr) : undefined,
        pts: values.pts ? Number(values.pts) : undefined,
        gstPercent: Number(values.gstPercent),
        stockQty: Number(values.stockQty),
        minOrderQty: Number(values.minOrderQty),
        isFastMoving: values.isFastMoving,
        isFeatured: values.isFeatured,
        isActive: values.isActive,
      };
      const res = await fetch(values.id ? `/api/admin/products/${values.id}` : '/api/admin/products', {
        method: values.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) return setError(json.error);
      router.push('/admin/products');
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        {error && <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p>}
        <Input id="name" label="Product name" value={values.name} onChange={(e) => set('name', e.target.value)} required />

        <div className="grid grid-cols-2 gap-3">
          <Select id="companyId" label="Company" value={values.companyId} onChange={(e) => set('companyId', e.target.value)} required>
            <option value="">Select company…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select id="categoryId" label="Category" value={values.categoryId ?? ''} onChange={(e) => set('categoryId', e.target.value)}>
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <Textarea id="composition" label="Composition" value={values.composition ?? ''} onChange={(e) => set('composition', e.target.value)} />

        <div className="grid grid-cols-3 gap-3">
          <Input id="packSize" label="Pack size" value={values.packSize ?? ''} onChange={(e) => set('packSize', e.target.value)} />
          <Input id="sku" label="SKU" value={values.sku ?? ''} onChange={(e) => set('sku', e.target.value)} />
          <Input id="productCode" label="Product code" value={values.productCode ?? ''} onChange={(e) => set('productCode', e.target.value)} />
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Input id="mrp" label="MRP (₹)" type="number" value={values.mrp} onChange={(e) => set('mrp', e.target.value)} required />
          <Input id="ptr" label="PTR (₹)" type="number" value={values.ptr} onChange={(e) => set('ptr', e.target.value)} />
          <Input id="pts" label="PTS (₹)" type="number" value={values.pts} onChange={(e) => set('pts', e.target.value)} />
          <Input id="gstPercent" label="GST %" type="number" value={values.gstPercent} onChange={(e) => set('gstPercent', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input id="stockQty" label="Stock quantity" type="number" value={values.stockQty} onChange={(e) => set('stockQty', e.target.value)} />
          <Input id="minOrderQty" label="Minimum order quantity" type="number" value={values.minOrderQty} onChange={(e) => set('minOrderQty', e.target.value)} />
        </div>

        <div className="flex gap-4 text-sm">
          <Checkbox label="Fast Moving" checked={values.isFastMoving} onChange={(v) => set('isFastMoving', v)} />
          <Checkbox label="Featured" checked={values.isFeatured} onChange={(v) => set('isFeatured', v)} />
          <Checkbox label="Active" checked={values.isActive} onChange={(v) => set('isActive', v)} />
        </div>

        <Button disabled={pending} onClick={submit}>
          {pending ? 'Saving…' : values.id ? 'Save Changes' : 'Create Product'}
        </Button>
      </CardBody>
    </Card>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
