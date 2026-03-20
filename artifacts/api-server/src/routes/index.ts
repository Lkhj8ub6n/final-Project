import { asyncHandler } from "../middlewares/error-handler";
import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import tenantsRouter from "./tenants";
import productsRouter from "./products";
import platformsRouter from "./platforms";
import cardsRouter from "./cards";
import shiftsRouter from "./shifts";
import invoicesRouter from "./invoices";
import returnsRouter from "./returns";
import staffRouter from "./staff";
import discountsRouter from "./discounts";
import printServicesRouter from "./print_services";
import ordersRouter from "./orders";
import reportsRouter from "./reports";
import notificationsRouter from "./notifications";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(tenantsRouter);
router.use(productsRouter);
router.use(platformsRouter);
router.use(cardsRouter);
router.use(shiftsRouter);
router.use(invoicesRouter);
router.use(returnsRouter);
router.use(staffRouter);
router.use(discountsRouter);
router.use(printServicesRouter);
router.use(ordersRouter);
router.use(reportsRouter);
router.use(notificationsRouter);
router.use(settingsRouter);

export default router;
