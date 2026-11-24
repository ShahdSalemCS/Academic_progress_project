import { useEffect, useRef, useState } from 'react';
import './register.css'; // styling for this page (file name must match exactly: register.css)

/**
 * Register to create a new account.
 * Props:
 *   onRegister(userData)  async function that talks to the backend.
 *     userData = { role, fullName, universityId, department, email, password, profilePicture }
 *     - profilePicture is a File object (or null if no picture was chosen)
 *     - throw an Error inside onRegister to show its message to the user
 */

/* ---------- Validation rules (change them here) ---------- */

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png']; // JPG / PNG
const MIN_PASSWORD_LENGTH = 8;

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u; // letters, spaces, ' . -
const UNIVERSITY_ID_PATTERN = /^\d{8}$/; // adjust to your university's ID format
const DEPARTMENT_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s&,'.()-]*$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// order of the fields on the page (used to focus the first invalid field)
const FIELD_ORDER = [
  'role',
  'fullName',
  'universityId',
  'department',
  'email',
  'password',
  'confirmPassword',
  'profilePicture'
];

const INITIAL_FORM_DATA = {
  role: '',
  fullName: '',
  universityId: '',
  department: '',
  email: '',
  password: '',
  confirmPassword: ''
};

const NO_STATUS = { type: '', text: '' };

/* ---------- Validation helpers ---------- */

// returns an error message for one text field, or '' when the value is valid
function validateField(name, values) {
  const value = values[name];

  switch (name) {
    case 'role':
      return value ? '' : 'Select your role: student, advisor, or instructor.';

    case 'fullName': {
      const text = value.trim();
      if (!text) return 'Enter your full name.';
      if (text.length < 2 || text.length > 60 || !NAME_PATTERN.test(text)) {
        return 'Use 2 to 60 letters. Spaces, hyphens, and apostrophes are allowed.';
      }
      return '';
    }

    case 'universityId': {
      const text = value.trim();
      const label = values.role === 'student' ? 'student ID' : 'university ID';
      if (!text) return `Enter your ${label}.`;
     if (!UNIVERSITY_ID_PATTERN.test(text)) {
  return 'University ID must contain exactly 8 digits.';
}
      return '';
    }

    case 'department': {
      const text = value.trim();
      if (!text) return 'Enter your department.';
      if (text.length < 2 || text.length > 60 || !DEPARTMENT_PATTERN.test(text)) {
        return 'Enter a valid department name, for example Computer Science.';
      }
      return '';
    }

    case 'email': {
      const text = value.trim();
      if (!text) return 'Enter your institutional email.';
      if (!EMAIL_PATTERN.test(text)) {
        return 'Enter a valid email address, for example name@university.edu.';
      }
      return '';
    }

    case 'password':
      if (!value) return 'Create a password.';
      if (value.length < MIN_PASSWORD_LENGTH) {
        return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
      }
      return '';

    case 'confirmPassword':
      if (!value) return 'Confirm your password.';
      if (value !== values.password) return 'Passwords do not match.';
      return '';

    default:
      return '';
  }
}

// profile picture is optional, but if one is chosen it must be a JPG/PNG up to 2 MB
function validateImage(file) {
  if (!file) return '';
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Choose a JPG or PNG image.';
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return 'This image is larger than 2 MB. Choose a smaller one.';
  }
  return '';
}

// checks the whole form and returns { fieldName: message } for every invalid field
function validateForm(values, picture) {
  const errors = {};

  FIELD_ORDER.forEach((name) => {
    const message =
      name === 'profilePicture' ? validateImage(picture) : validateField(name, values);
    if (message) errors[name] = message;
  });

  return errors;
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ---------- Small presentational helper ---------- */

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <small id={id} role="alert">
      {message}
    </small>
  );
}

/* ---------- Default backend hook (used until a real onRegister is passed in) ---------- */

async function logRegistration(userData) {
  console.log('onRegister payload (password hidden):', {
    ...userData,
    password: '********',
    profilePicture: userData.profilePicture ? userData.profilePicture.name : null
  });
}

/* ---------- Component ---------- */

function Register({ onRegister = logRegistration }) {
  // form values
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  // one error message per field, e.g. { email: 'Enter a valid email...' }
  const [errors, setErrors] = useState({});

  // profile picture file and its preview address
  const [profilePicture, setProfilePicture] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const previewUrlRef = useRef('');
  const fileInputRef = useRef(null);

  // show/hide password
  const [showPassword, setShowPassword] = useState({
    password: false,
    confirmPassword: false
  });

  // form-level success / error message
  const [status, setStatus] = useState(NO_STATUS);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // free the preview image from memory when the component is removed
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  /* ----- profile picture ----- */

  const clearPicture = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = '';
    setPreviewUrl('');
    setProfilePicture(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePictureChange = (event) => {
    const file = event.target.files[0];
    setStatus(NO_STATUS);

    // nothing selected (for example the dialog was cancelled)
    if (!file) {
      clearPicture();
      setErrors((previous) => ({ ...previous, profilePicture: '' }));
      return;
    }

    // wrong type or too big: reject the file and explain why
    const imageError = validateImage(file);
    if (imageError) {
      clearPicture();
      setErrors((previous) => ({ ...previous, profilePicture: imageError }));
      return;
    }

    // valid image: keep it and show a preview
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setProfilePicture(file);
    setErrors((previous) => ({ ...previous, profilePicture: '' }));
  };

  /* ----- text fields ----- */

    const handleChange = (event) => {
    const { name, value } = event.target;
  const nextValue = name === 'universityId'
    ? value.replace(/\D/g, '').slice(0, 8)
    : value;
  const nextData = { ...formData, [name]: nextValue };

    setFormData(nextData);
    setStatus(NO_STATUS);

    // re-check a field that is already showing an error,
    // so the message disappears as soon as the problem is fixed
    setErrors((previous) => {
      const next = { ...previous };
      if (previous[name]) next[name] = validateField(name, nextData);
      if (name === 'password' && nextData.confirmPassword) {
        next.confirmPassword = validateField('confirmPassword', nextData);
      }
      return next;
    });
  };

  // validate a field when the user leaves it
  const handleBlur = (event) => {
    const { name } = event.target;
    setErrors((previous) => ({ ...previous, [name]: validateField(name, formData) }));
  };

  // props shared by every text field: id, value, handlers and accessibility attributes
  const fieldProps = (name) => ({
    id: name,
    name,
    value: formData[name],
    onChange: handleChange,
    onBlur: handleBlur,
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': errors[name] ? `${name}-error` : undefined
  });

  const togglePassword = (field) => {
    setShowPassword((previous) => ({ ...previous, [field]: !previous[field] }));
  };

  /* ----- submit ----- */

  const resetForm = () => {
    setFormData(INITIAL_FORM_DATA);
    setErrors({});
    setShowPassword({ password: false, confirmPassword: false });
    clearPicture();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    const newErrors = validateForm(formData, profilePicture);
    setErrors(newErrors);

    const firstInvalid = FIELD_ORDER.find((name) => newErrors[name]);
    if (firstInvalid) {
      setStatus({ type: 'error', text: 'Fix the highlighted fields and try again.' });
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    // data sent to the backend (confirmPassword is not needed there)
    const userData = {
      role: formData.role,
      fullName: formData.fullName.trim(),
      universityId: formData.universityId.trim(),
      department: formData.department.trim(),
      email: formData.email.trim().toLowerCase(),
      password: formData.password,
      profilePicture // File or null
    };

    setIsSubmitting(true);
    setStatus(NO_STATUS);

    try {
      await onRegister(userData);
      resetForm();
      setStatus({ type: 'success', text: 'Account created successfully!' });
    } catch (error) {
      setStatus({
        type: 'error',
        text: error?.message || 'Could not create your account. Try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const idLabel = formData.role === 'student' ? 'Student ID' : 'University ID';

  return (
    <div className="register-container">
      <header>
        <h2>Academic Progress</h2>

        <nav>
          <a href="#">Sign In</a>
          <a href="#">Create Account</a>
        </nav>
      </header>

      <main>
        <h1 className="register-title">Create Account</h1>
        <p className="register-subtitle">Join our academic progress platform</p>

        {/* noValidate: the messages come from our own validation above */}
        <form className="register-form" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="role">Account Role</label>
            <select className="register-select" required {...fieldProps('role')}>
              <option value="">Select your role</option>
              <option value="student">Student</option>
              <option value="advisor">Academic Advisor</option>
              <option value="instructor">Instructor</option>
            </select>
            <FieldError id="role-error" message={errors.role} />
          </div>

          <div>
            <label htmlFor="fullName">Full Name</label>
            <input
              className="register-input"
              type="text"
              placeholder="Enter your full name"
              autoComplete="name"
              maxLength={60}
              required
              {...fieldProps('fullName')}
            />
            <FieldError id="fullName-error" message={errors.fullName} />
          </div>

          <div>
            <label htmlFor="universityId">{idLabel}</label>
           <input
            className="register-input"
            type="text"
            inputMode="numeric"
            placeholder="Enter 8-digit University ID"
            autoComplete="off"
            maxLength={8}
            required
            {...fieldProps('universityId')}
          />
            <FieldError id="universityId-error" message={errors.universityId} />
          </div>

          <div>
            <label htmlFor="department">Department</label>
            <input
              className="register-input"
              type="text"
              placeholder="Enter your department"
              maxLength={60}
              required
              {...fieldProps('department')}
            />
            <FieldError id="department-error" message={errors.department} />
          </div>

          <div>
            <label htmlFor="email">Institutional Email</label>
            <input
              className="register-input"
              type="email"
              placeholder="name@university.edu"
              autoComplete="email"
              required
              {...fieldProps('email')}
            />
            <FieldError id="email-error" message={errors.email} />
          </div>

          <div>
            <label htmlFor="password">Password</label>
            <div>
              <input
                className="register-input"
                type={showPassword.password ? 'text' : 'password'}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                autoComplete="new-password"
                required
                {...fieldProps('password')}
              />
              <button
                type="button"
                onClick={() => togglePassword('password')}
                aria-label={showPassword.password ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword.password}
              >
                {showPassword.password ? 'Hide' : 'Show'}
              </button>
            </div>
            <FieldError id="password-error" message={errors.password} />
          </div>

          <div>
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div>
              <input
                className="register-input"
                type={showPassword.confirmPassword ? 'text' : 'password'}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                required
                {...fieldProps('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => togglePassword('confirmPassword')}
                aria-label={
                  showPassword.confirmPassword
                    ? 'Hide password confirmation'
                    : 'Show password confirmation'
                }
                aria-pressed={showPassword.confirmPassword}
              >
                {showPassword.confirmPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <FieldError id="confirmPassword-error" message={errors.confirmPassword} />
          </div>

          <div>
            <label htmlFor="profilePicture">Profile Picture (Optional)</label>
            <input
              className="register-input"
              id="profilePicture"
              name="profilePicture"
              type="file"
              accept="image/jpeg, image/png"
              ref={fileInputRef}
              onChange={handlePictureChange}
              aria-invalid={Boolean(errors.profilePicture)}
              aria-describedby={
                errors.profilePicture
                  ? 'profilePicture-hint profilePicture-error'
                  : 'profilePicture-hint'
              }
            />
            <small id="profilePicture-hint">JPG or PNG, up to 2 MB.</small>
            <FieldError id="profilePicture-error" message={errors.profilePicture} />

            {previewUrl && (
              <figure>
                <img src={previewUrl} alt="Preview of your profile picture" />
                <figcaption>
                  {profilePicture.name} ({formatFileSize(profilePicture.size)})
                </figcaption>
                <button type="button" onClick={clearPicture}>
                  Remove
                </button>
              </figure>
            )}
          </div>

          {status.text && (
            <p role={status.type === 'error' ? 'alert' : 'status'}>{status.text}</p>
          )}

          <button className="register-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="login-link">
          Already have an account? <a href="#">Sign In</a>
        </p>
      </main>
    </div>
  );
}

export default Register;