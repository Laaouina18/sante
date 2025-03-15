
import mongoose from "mongoose";
/**
 * @async
 * @returns {Promise<void>} 
 * @throws {Error} 
 */

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
  
        // const conn = await mongoose.connect(process.env.LOCAL_MONGO_URI);

         console.log(`MongoDB connected ${conn.connection.host}`);

    } catch (error ) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;
