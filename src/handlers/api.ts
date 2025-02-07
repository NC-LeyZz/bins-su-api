import { Hono } from "hono";
import { alphaToInfo, Country } from "../utils";
import fetch from "node-fetch";
import csvParser from "csv-parser";
import stream from "stream";

const app = new Hono();

interface Result {
  result: boolean;
  message: string;
  data: {
    bin: number;
    vendor: string;
    type: string;
    category: string;
    issuer: string;
    issuerPhone: string;
    issuerUrl: string;
    isoCode2: string;
    isoCode3: string;
    countryName: string;
  } | null;
}

const BIN_DB_URL = "https://raw.githubusercontent.com/venelinkochev/bin-list-data/refs/heads/master/bin-list-data.csv";

async function fetchBinData() {
  const response = await fetch(BIN_DB_URL);
  if (!response.ok) {
    throw new Error("Failed to fetch BIN database");
  }

  const results: any[] = [];
  const readableStream = stream.Readable.from(await response.text());

  return new Promise((resolve, reject) => {
    readableStream
      .pipe(csvParser())
      .on("data", (row) => results.push(row))
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
}

app.get("/:bin", async (c) => {
  const bin = c.req.param("bin");
  c.set("Cache-Control", "public, max-age=86400");

  const meta: Pick<Result, "result" | "message"> = {
    result: false,
    message: "Invalid BIN",
  };
  let data: Result["data"] = null;

  if (!bin || bin.length < 6 || bin.length > 16 || !/^[0-9]+$/.test(bin)) {
    return c.json({ ...meta, data });
  }

  try {
    const binList: any[] = (await fetchBinData()) as any[];
    const binEntry = binList.find((entry) => entry.BIN === bin);

    if (binEntry) {
      meta.result = true;
      meta.message = "BIN Found";

      data = {
        bin: Number(binEntry.BIN),
        vendor: binEntry.Brand,
        type: binEntry.Type,
        category: binEntry.Category,
        issuer: binEntry.Issuer,
        issuerPhone: binEntry.IssuerPhone,
        issuerUrl: binEntry.IssuerUrl,
        isoCode2: binEntry.isoCode2,
        isoCode3: binEntry.isoCode3,
        countryName: binEntry.CountryName,
      };
    } else {
      meta.message = "BIN Not Found";
    }
  } catch (error) {
    meta.message = "Error fetching BIN data";
  }

  return c.json({ ...meta, data });
});

export default app;
