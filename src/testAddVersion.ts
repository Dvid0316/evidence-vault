import "dotenv/config";
import { ChangeType } from "@prisma/client";
import { addVersion } from "./services/recordService";

async function run() {
  const result = await addVersion({
    recordId: "d829241d-046c-481a-9fd6-b4bd8207e978",
    contentText: "FORCE VERSION 3 – " + Math.random(),
    actorUserId: "cmllijj4m0000k4gpi37dxe9v",
    changeType: ChangeType.MODIFIED,
    changeSummary: "manual test edit",
  });

  console.log(result);
}

run()
  .catch(console.error)
  .finally(() => process.exit(0));