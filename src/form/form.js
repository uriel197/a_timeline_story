import { getOriginNode } from "../db/db.js";
import { buildOriginContext } from "../db/db_logic/contextBuilder.js";
import { renderOriginForm } from "./originForm.js";

export const setupForm = async (container, db, manager) => {
  const refreshUI = async () => {
    const origin = await getOriginNode(db);

    if (origin) {
      console.log(
        `Welcome back, ${origin.firstName}. Booting Timeline Engine...`,
      );
      const originContext = await buildOriginContext(db);
      await manager.executeContextBoot(originContext);
    } else {
      console.log("No profile found. Launching initial setup form...");
      renderOriginForm(container, db, refreshUI);
    }
  };

  refreshUI();
};
