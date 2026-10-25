import { describe, expect, it } from "vitest";

import { MAX_UPLOAD_BYTES, fitWithin, safeFileName, storagePath, uploadProblem } from "@/lib/uploads";

describe("uploads", () => {
  it("builds org-scoped paths with safe names", () => {
    expect(storagePath("org-1", "rec-9", "Site Photo (1).JPG", "abc")).toBe("org-1/rec-9/abc-site-photo-1.jpg");
    expect(safeFileName("../../etc/passwd")).toBe("....etcpasswd");
    expect(safeFileName("💥")).toBe("file");
  });

  it("refuses wrong types, empty and oversized files with a sentence", () => {
    expect(uploadProblem({ size: 10, type: "application/x-msdownload" })).toBe("Attach a photo, PDF or CSV.");
    expect(uploadProblem({ size: 0, type: "image/png" })).toBe("That file is empty.");
    expect(uploadProblem({ size: MAX_UPLOAD_BYTES + 1, type: "image/jpeg" })).toBe("Files must be 10 MB or smaller.");
    expect(uploadProblem({ size: 1000, type: "application/pdf" })).toBeNull();
  });

  it("shrinks phone photos to the longest side without upscaling", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
