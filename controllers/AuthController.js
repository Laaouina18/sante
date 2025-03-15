import User from '../models/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Generate JWT Token
export const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Generate file number for patients
const generateFileNumber = (patient) => {
  const firstNameInitial = patient.firstName.charAt(0).toUpperCase();
  const lastNameInitial = patient.lastName.charAt(0).toUpperCase();
  const birthYear = new Date(patient.dateOfBirth).getFullYear();
  const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  return `${firstNameInitial}${lastNameInitial}${birthYear}${randomNum}`;
};

// Generate password for doctors
const generateDoctorPassword = (doctor) => {
  const specialty = doctor.specialty.substring(0, 3).toUpperCase();
  const firstNameInitial = doctor.firstName.charAt(0).toUpperCase();
  const lastNameInitial = doctor.lastName.charAt(0).toUpperCase();
  const phoneDigits = doctor.phone.slice(-4);
  
  return `${specialty}${firstNameInitial}${lastNameInitial}${phoneDigits}`;
};

// Register a new user
export const register = async (req, res) => {

  const { 
    firstName,
    lastName,
    email,
    phone,
    role,
   
    specialty,
    bio,
    hourlyRate,
    dateOfBirth,
    gender,
    identityDocument,
    address,
    country,
    city
  } = req.body;

  const image = req.file ? req.file.path : null;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ 
        message: 'A user with this email already exists.' 
      });
    }

    let password, fileNumber, generatedPassword;
    
    // Handle patient registration
    if (role === 'patient') {
      fileNumber = generateFileNumber({
        firstName,
        lastName,
        dateOfBirth
      });
      
      password = null; // For patients, we don't set a password as they'll use ID doc + file number
    } 
    // Handle doctor registration
    else if (role === 'doctor') {
      generatedPassword = generateDoctorPassword({
        specialty,
        firstName,
        lastName,
        phone
      });
      password = await bcrypt.hash(generatedPassword, 10);
    }

    // Create new user with all fields
    const newUser = new User({
      firstName,
      lastName,
      email,
      password,
      city,
      country,
      phone,
      role,
      specialty: role === 'doctor' ? specialty : undefined,
      bio: role === 'doctor' ? bio : undefined,
      hourlyRate: role === 'doctor' ? hourlyRate : undefined,
      fileNumber,
      dateOfBirth: role === 'patient' ? dateOfBirth : undefined,
      gender: role === 'patient' ? gender : undefined,
      identityDocument: role === 'patient' ? identityDocument : undefined,
      address,
      country,
      city,
      image
    });

    await newUser.save();

    // Generate JWT token
    const token = generateToken(newUser._id);

    // Remove password from response
    const userResponse = newUser.toObject();
    delete userResponse.password;

    // Include generated password in response for doctors
    const responseData = {
      message: 'User created successfully',
      user: userResponse,
      token,
      fileNumber:fileNumber
    };

    if (role === 'doctor') {
      responseData.generatedPassword = generatedPassword;
    }

    return res.status(201).json(responseData);

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      message: 'An error occurred during registration.',
      error: error.message
    });
  }
};


// Other controller methods remain the same
export const getAll = async (req, res) => {
  try {
    const users = await User.find().select('-password').populate('medicalRecords');
    return res.status(200).json(users);
  } catch (error) {
    console.error('Error retrieving users:', error);
    return res.status(500).json({
      message: 'An error occurred while retrieving users.',
      error: error.message
    });
  }
};
export const updateUser = async (req, res) => {
  const userId = req.params.id;
  const updates = req.body;
  const image = req.file ? req.file.path : null;

  try {
    // Check if user exists
    const user = await User.findById(userId).populate('medicalRecords');
    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    // If email is being updated, check if new email already exists
    if (updates.email && updates.email !== user.email) {
      const existingUser = await User.findOne({ email: updates.email });
      if (existingUser) {
        return res.status(409).json({
          message: 'A user with this email already exists'
        });
      }
    }

    // Update basic fields if provided and not empty
    const updateFields = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'specialty',
      'bio',
      'hourlyRate',
      'gender',
      'dateOfBirth'
    ];

    updateFields.forEach(field => {
      if (updates[field] !== undefined && updates[field] !== '') {
        user[field] = updates[field];
      }
    });

    // Update image if provided
    if (image) {
      user.image = image;
    }

    // Handle password update if provided
    if (updates.password && updates.password !== '') {
      user.password = await bcrypt.hash(updates.password, 10);
    }

    // Save updated user
    await user.save();

    // Remove sensitive data before sending response
    const userResponse = user.toObject();
    delete userResponse.password;

    return res.status(200).json({
      message: 'User updated successfully',
      user: userResponse
    });

  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({
      message: 'An error occurred while updating user information',
      error: error.message
    });
  }
};

export const getById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id).select('-password').populate('medicalRecords').populate('users');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error('Error retrieving user:', error);
    return res.status(500).json({
      message: 'An error occurred while retrieving the user.',
      error: error.message
    });
  }
};

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.userId = decoded.id;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};
// Archiver un utilisateur
export const archiveUser = async (req, res) => {
  const { id } = req.params;
  
  try {
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ 
        message: 'Utilisateur non trouvé' 
      });
    }

    // Mettre à jour le statut d'archive
    user.isArchived = true;
    user.archivedAt = new Date();
    user.isActive = false; // Désactiver le compte lors de l'archivage
    
    await user.save();

    // Retirer les données sensibles avant l'envoi
    const userResponse = user.toObject();
    delete userResponse.password;

    return res.status(200).json({
      message: 'Utilisateur archivé avec succès',
      user: userResponse
    });
  } catch (error) {
    console.error('Erreur lors de l\'archivage:', error);
    return res.status(500).json({
      message: 'Une erreur est survenue lors de l\'archivage de l\'utilisateur',
      error: error.message
    });
  }
};

// Désarchiver un utilisateur
export const unarchiveUser = async (req, res) => {
  const { id } = req.params;
  
  try {
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ 
        message: 'Utilisateur non trouvé' 
      });
    }

    // Mettre à jour le statut d'archive
    user.isArchived = false;
    user.archivedAt = null;
    // Ne pas réactiver automatiquement le compte lors du désarchivage
    
    await user.save();

    // Retirer les données sensibles avant l'envoi
    const userResponse = user.toObject();
    delete userResponse.password;

    return res.status(200).json({
      message: 'Utilisateur désarchivé avec succès',
      user: userResponse
    });
  } catch (error) {
    console.error('Erreur lors du désarchivage:', error);
    return res.status(500).json({
      message: 'Une erreur est survenue lors du désarchivage de l\'utilisateur',
      error: error.message
    });
  }
};

// Activer un compte utilisateur
export const activateUser = async (req, res) => {
  const { id } = req.params;
  
  try {
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ 
        message: 'Utilisateur non trouvé' 
      });
    }

    if (user.isArchived) {
      return res.status(400).json({
        message: 'Impossible d\'activer un compte archivé'
      });
    }

    user.isActive = true;
    user.activatedAt = new Date();
    
    await user.save();

    // Retirer les données sensibles avant l'envoi
    const userResponse = user.toObject();
    delete userResponse.password;

    return res.status(200).json({
      message: 'Compte utilisateur activé avec succès',
      user: userResponse
    });
  } catch (error) {
    console.error('Erreur lors de l\'activation:', error);
    return res.status(500).json({
      message: 'Une erreur est survenue lors de l\'activation du compte',
      error: error.message
    });
  }
};

// Désactiver un compte utilisateur
export const deactivateUser = async (req, res) => {
  const { id } = req.params;
  
  try {
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ 
        message: 'Utilisateur non trouvé' 
      });
    }

    user.isActive = false;
    user.deactivatedAt = new Date();
    
    await user.save();

    // Retirer les données sensibles avant l'envoi
    const userResponse = user.toObject();
    delete userResponse.password;

    return res.status(200).json({
      message: 'Compte utilisateur désactivé avec succès',
      user: userResponse
    });
  } catch (error) {
    console.error('Erreur lors de la désactivation:', error);
    return res.status(500).json({
      message: 'Une erreur est survenue lors de la désactivation du compte',
      error: error.message
    });
  }
};

// Modifier la fonction login pour vérifier si le compte est actif et non archivé
export const login = async (req, res) => {
  console.log("Login request received:", req.body);
  const { 
    role,
    identityDocument,
    fileNumber,
    email,
    password
  } = req.body;

  try {
    let user;

    if (role === 'patient') {
      if (!identityDocument || !fileNumber) {
        return res.status(400).json({ 
          message: 'Identity document and file number are required for patient login' 
        });
      }

      user = await User.findOne({
        role: 'patient',
        fileNumber,
        'identityDocument.number': identityDocument.number
      });
    } else if (role === 'doctor') {
      if (!email || !password) {
        return res.status(400).json({ 
          message: 'Email and password are required for doctor login' 
        });
      }

      user = await User.findOne({ role: 'doctor', email });

      if (user) {
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return res.status(401).json({ message: 'Invalid credentials' });
        }
      }
    } else {
      return res.status(400).json({ message: 'Invalid role specified' });
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Vérifier si le compte est archivé
    // if (user.isArchived) {
    //   return res.status(403).json({ 
    //     message: 'Ce compte a été archivé. Veuillez contacter l\'administrateur.' 
    //   });
    // }

    // Vérifier si le compte est actif
    // if (!user.isActive) {
    //   return res.status(403).json({ 
    //     message: 'Ce compte n\'est pas actif. Veuillez attendre l\'activation de votre compte.' 
    //   });
    // }

    // Generate JWT token
    const token = generateToken(user._id);

    // Remove password from response
    const userResponse = {
      _id:user._id
    }
    delete userResponse.password;

    return res.status(200).json({
      message: 'Login successful',
      user: userResponse,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      message: 'An error occurred during login.',
      error: error.message
    });
  }
};