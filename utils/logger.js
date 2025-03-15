
import winston from "winston";
const logger = winston.createLogger({
	level: "info",
	format: winston.format.combine(
		winston.format.colorize({
			all: true,
			colors: {
				info: "blue",
				warn: "yellow",
				error: "red",
			},
		}),
		winston.format.label({
			label: "[LOGGER]",
		}),
		winston.format.timestamp({
			format: "YY-MM-DD HH:mm:ss",
		}),
		winston.format.printf((info) => ` ${info.label}  ${info.timestamp}  ${info.level} : ${info.message}`),
	),
	//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
	transports: [
		new winston.transports.Console(),
	],
});
export default logger;
