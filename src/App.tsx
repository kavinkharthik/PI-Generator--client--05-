
import React, { useState } from "react";
import "./Form.css";

type LineItem = {
  particulars: string;
  hsn: string;
  dcNo: string;
  rate: string;
  quantity: string;
};

type FormState = {
  receiverName: string;
  receiverAddress: string;
  receiverPhone: string;
  receiverEmail: string;
  receiverGstin: string;
  poNumber: string;
  poDate: string;
  transportMode: string;
  deliveryDate: string;
  destination: string;
  cgstRate: string;
  sgstRate: string;
  igstRate: string;
  toEmail: string;
  emailSubject: string;
  emailBody: string;
};

const emptyForm: FormState = {
  receiverName: "",
  receiverAddress: "",
  receiverPhone: "",
  receiverEmail: "",
  receiverGstin: "",
  poNumber: "",
  poDate: "",
  transportMode: "",
  deliveryDate: "",
  destination: "",
  cgstRate: "0",
  sgstRate: "0",
  igstRate: "0",
  toEmail: "",
  emailSubject: "Purchase Order – SRI CHAKRI TRADERS",
  emailBody: "",
};

const maxItems = 10;

export const App: React.FC = () => {
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  const API_BASE_URL = (
    (isLocalhost
      ? "http://localhost:4000"
      : import.meta.env.VITE_API_BASE_URL || "https://pi-generator-server-05-1.onrender.com")
  ).replace(/\/+$/, "");

  const fetchWithTimeout = async (
    input: RequestInfo | URL,
    init: RequestInit,
    timeoutMs: number
  ) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const getErrorMessageFromResponse = async (resp: Response) => {
    const contentType = resp.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await resp.json().catch(() => ({} as any));
      return (
        data?.error ||
        data?.message ||
        `Request failed (${resp.status})`
      );
    }

    const text = await resp.text().catch(() => "");
    return text || `Request failed (${resp.status})`;
  };

  React.useEffect(() => {
    fetch("/logo.png")
      .then(res => res.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setLogoDataUrl(reader.result as string);
        };
        reader.readAsDataURL(blob);
      })
      .catch(err => console.error("Failed to load logo:", err));
  }, []);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [items, setItems] = useState<LineItem[]>([
    { particulars: "", hsn: "", dcNo: "", rate: "", quantity: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (
    index: number,
    field: keyof LineItem,
    value: string
  ) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addRow = () => {
    setItems((prev) => {
      if (prev.length >= maxItems) return prev;
      return [...prev, { particulars: "", hsn: "", dcNo: "", rate: "", quantity: "" }];
    });
  };

  const removeRow = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (requireEmail = false): string | null => {
    const requiredTextFields: (keyof FormState)[] = [
      "receiverName",
      "receiverPhone",
      "poNumber",
    ];

    if (requireEmail) {
      requiredTextFields.push("toEmail");
    }

    for (const f of requiredTextFields) {
      if (!form[f].trim()) {
        return `Field "${f}" is required.`;
      }
    }

    if (!/^\d+(\.\d+)?$/.test(form.cgstRate || "0")) return "Invalid CGST value.";
    if (!/^\d+(\.\d+)?$/.test(form.sgstRate || "0")) return "Invalid SGST value.";
    if (!/^\d+(\.\d+)?$/.test(form.igstRate || "0")) return "Invalid IGST value.";

    if (!items.length) return "At least one line item is required.";

    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      if (!row.particulars.trim()) {
        return `Row ${i + 1}: particulars is required.`;
      }
      if (!/^\d+(\.\d+)?$/.test(row.rate || "")) {
        return `Row ${i + 1}: rate must be numeric.`;
      }
      if (!/^\d+(\.\d+)?$/.test(row.quantity || "")) {
        return `Row ${i + 1}: quantity must be numeric.`;
      }
    }

    return null;
  };

  const handleDownload = async () => {
    setError(null);
    setSuccess(null);
    const validationError = validate(false);
    if (validationError) {
      setError(validationError);
      return;
    }

    setDownloading(true);
    try {
      const numericItems = items.map((it) => ({
        ...it,
        rate: it.rate,
        quantity: it.quantity,
      }));

      const payload = {
        ...form,
        items: numericItems,
        piDate: form.poDate,
        logoDataUrl,
      };

      const resp = await fetchWithTimeout(
        `${API_BASE_URL}/api/generate-pdf`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        90000
      );

      if (!resp.ok) {
        const message = await getErrorMessageFromResponse(resp);
        throw new Error(message || "Failed to generate PDF");
      }

      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proforma-invoice-${form.poNumber || Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess("PDF generated and downloaded successfully.");
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setError("Request timed out. Render may be waking up. Please try again.");
      } else {
        setError(err?.message || "Unexpected error");
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleEmail = async () => {
    setError(null);
    setSuccess(null);
    const validationError = validate(true);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const numericItems = items.map((it) => ({
        ...it,
        rate: it.rate,
        quantity: it.quantity,
      }));

      const payload = {
        ...form,
        items: numericItems,
        piDate: form.poDate,
        logoDataUrl,
      };

      const resp = await fetchWithTimeout(
        `${API_BASE_URL}/api/generate-and-email-pdf`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        90000
      );

      if (!resp.ok) {
        const message = await getErrorMessageFromResponse(resp);
        throw new Error(message || "Failed to generate / email PDF");
      }

      setSuccess("PDF generated and emailed successfully.");
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setError("Request timed out. Render may be waking up. Please try again.");
      } else {
        setError(err.message || "Unexpected error");
      }
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="po-container">
      <h2 className="po-header">
        Proforma Invoice Generator - SRI CHAKRI TRADERS
      </h2>
      <p className="po-description">
        Generate Proforma Invoice PDF from scratch matching SRI CHAKRI TRADERS format.
        You can download the PDF or send it via email.
      </p>

      <form className="po-form">

        <fieldset>
          <legend>Receiver Details</legend>
          <div className="grid-2">
            <label>
              To / Receiver Name
              <input
                name="receiverName"
                value={form.receiverName}
                onChange={handleFormChange}
                maxLength={60}
              />
            </label>
            <label>
              Receiver GSTIN
              <input
                name="receiverGstin"
                value={form.receiverGstin}
                onChange={handleFormChange}
                maxLength={20}
              />
            </label>
          </div>
          <label>
            Receiver Address
            <textarea
              name="receiverAddress"
              value={form.receiverAddress}
              onChange={handleFormChange}
              maxLength={200}
              rows={3}
            />
          </label>
          <div className="grid-3">
            <label>
              Phone Number
              <input
                name="receiverPhone"
                value={form.receiverPhone}
                onChange={handleFormChange}
                maxLength={20}
              />
            </label>
            <label>
              Receiver Email
              <input
                name="receiverEmail"
                type="email"
                value={form.receiverEmail}
                onChange={handleFormChange}
                maxLength={80}
              />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Order Details</legend>
          <div className="grid-3">
            <label>
              PO / PI Number
              <input
                name="poNumber"
                value={form.poNumber}
                onChange={handleFormChange}
                maxLength={30}
              />
            </label>
            <label>
              PO / PI Date
              <input
                name="poDate"
                type="date"
                value={form.poDate}
                onChange={handleFormChange}
              />
            </label>
            <label>
              Transport Mode
              <input
                name="transportMode"
                value={form.transportMode}
                onChange={handleFormChange}
                maxLength={40}
              />
            </label>
          </div>
          <div className="grid-2">
            <label>
              Delivery Date
              <input
                name="deliveryDate"
                type="date"
                value={form.deliveryDate}
                onChange={handleFormChange}
              />
            </label>
            <label>
              Destination
              <input
                name="destination"
                value={form.destination}
                onChange={handleFormChange}
                maxLength={60}
              />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Line Items</legend>
          <table className="po-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Particulars</th>
                <th>HSN Code</th>
                <th>D.C. No</th>
                <th>Rate (Rs.)</th>
                <th>Quantity</th>
                <th>Amount (Rs. Ps.)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, index) => {
                const rate = parseFloat(row.rate || "0") || 0;
                const qty = parseFloat(row.quantity || "0") || 0;
                const amount = rate * qty;
                return (
                  <tr key={index}>
                    <td className="center">{index + 1}</td>
                    <td>
                      <input
                        value={row.particulars}
                        maxLength={80}
                        onChange={(e) =>
                          handleItemChange(index, "particulars", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        value={row.hsn}
                        maxLength={20}
                        onChange={(e) =>
                          handleItemChange(index, "hsn", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        value={row.dcNo}
                        maxLength={20}
                        onChange={(e) =>
                          handleItemChange(index, "dcNo", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        value={row.rate}
                        onChange={(e) =>
                          handleItemChange(index, "rate", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        value={row.quantity}
                        onChange={(e) =>
                          handleItemChange(index, "quantity", e.target.value)
                        }
                      />
                    </td>
                    <td className="right">
                      {isNaN(amount) ? "" : amount.toFixed(2)}
                    </td>
                    <td>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          className="link-button"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button
            type="button"
            onClick={addRow}
            disabled={items.length >= maxItems}
            className="btn btn-add-row"
          >
            + Add New Item
          </button>
          {items.length >= maxItems && (
            <p className="note">Maximum rows reached for this PDF template.</p>
          )}
        </fieldset>

        <fieldset>
          <legend>Tax</legend>
          <div className="grid-3">
            <label>
              CGST (%)
              <input
                name="cgstRate"
                value={form.cgstRate}
                onChange={handleFormChange}
              />
            </label>
            <label>
              SGST (%)
              <input
                name="sgstRate"
                value={form.sgstRate}
                onChange={handleFormChange}
              />
            </label>
            <label>
              IGST (%)
              <input
                name="igstRate"
                value={form.igstRate}
                onChange={handleFormChange}
              />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Email</legend>
          <label>
            To (email)
            <input
              name="toEmail"
              type="email"
              value={form.toEmail}
              onChange={handleFormChange}
            />
          </label>
          <label>
            Subject
            <input
              name="emailSubject"
              value={form.emailSubject}
              onChange={handleFormChange}
            />
          </label>
          <label>
            Body
            <textarea
              name="emailBody"
              value={form.emailBody}
              onChange={handleFormChange}
              rows={4}
            />
          </label>
        </fieldset>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        <div className="form-actions">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading || submitting}
            className="btn btn-primary"
          >
            {downloading ? "Generating..." : "Download PDF"}
          </button>
          <button
            type="button"
            onClick={handleEmail}
            disabled={downloading || submitting}
            className="btn btn-secondary"
          >
            {submitting ? "Sending..." : "Generate & Email PDF"}
          </button>
        </div>
      </form>
    </div>
  );
};



