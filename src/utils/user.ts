export default function getUserFullName(firstName, lastName) {
    if (!firstName && !lastName) {
      return '';
    }
    const fullName = lastName ? `${firstName} ${lastName}` : `${firstName}`;
    return fullName.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
  }