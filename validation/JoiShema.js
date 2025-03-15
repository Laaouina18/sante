import Joi from "joi";
export const houseSchema = Joi.object({
	Type: Joi.string().required(),
	Description: Joi.string().required(),
	Price: Joi.number().required(),
	Location: Joi.string().required(),
	House_Area: Joi.number().required(),
	Transaction_Type: Joi.string().required(),
	Home_pic: Joi.string().required(),
	Owner: Joi.string().required(),
});

export const floorSchema = Joi.object({
	House: Joi.string().required(),
	Floor_pic_url:Joi.string().required(),
	floorNumber: Joi.number().required()
});
export const roomSchema = Joi.object({
	Floor: Joi.string().required(),
	roomNumber: Joi.number().required(),
	room_pic:Joi.string().required(),
	House:Joi.string().required(),
	roomArea: Joi.string().required(),
	roomType: Joi.string().required(),
	description: Joi.string().required()

});
export const ClientsSchema = Joi.object({
	name: Joi.string().min(3).max(30).required(),
	email: Joi.string().email().required(),
	phone: Joi.string().min(10).max(15).required(),
	houseId: Joi.number().required(),
});
export const rentSchema = Joi.object({
	roomId: Joi.number().required(),
	clientId: Joi.number().required(),
	rent: Joi.number().required(),
});
export const UserSchema = Joi.object({
	firstName: Joi.string().min(3).max(30).required(),
	lastName: Joi.string().min(3).max(30).required(),
	email: Joi.string().email().required(),
	phone: Joi.string().required(),
	password: Joi.string().min(6).max(30).required(),
	role: Joi.string().required(),
	confirmPassword: Joi.ref("password"),
});
const validator = (schema, data) => {
    const { error } = schema.validate(data);
    if (error) {
        const errors = error.details.map((detail) => detail.message);
        throw new Error(errors);
    }
};

