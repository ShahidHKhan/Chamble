export type DataEnvelope<T> = {
  data: T | null;
  isSuccess: boolean;
  message?: string;
};

export type DataListEnvelope<T> = DataEnvelope<T[]> & {
  total: number;
};

const API_BASE_URL = import.meta.env.VITE_API_ROOT ?? "http://localhost:3001";

export default function rest<T>(
  url: string,
  data?: unknown,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("chambleToken");
  options = {
    method: data ? "POST" : "GET",
    body: data ? JSON.stringify(data) : undefined,
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  };

  return fetch(url, options).then((res) => {
    if (!res.ok) {
      if (res.headers.get("Content-Type")?.includes("application/json")) {
        return res.json().then((errorData: { message?: string }) => {
          throw new Error(errorData.message || "An error occurred");
        });
      }

      return res.text().then((text) => {
        throw new Error(text);
      });
    }

    return res.json() as Promise<T>;
  });
}

export function api<T>(
  endpoint: string,
  data?: unknown,
  options: RequestInit = {}
) {
  const base = API_BASE_URL.replace(/\/+$/, "");
  const path = endpoint.replace(/^\/+/, "");
  return rest<T>(`${base}/${path}`, data, options);
}
