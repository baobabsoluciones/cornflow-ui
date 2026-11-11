export default function getUserFullName(firstName, lastName) {
    if (!firstName && !lastName) {
      return '';
    }
    const fullName = lastName ? `${firstName} ${lastName}` : `${firstName}`;
    // A word starts after anything that is not a letter, a digit or an underscore, so accented
    // letters ("José García-López") stay inside their word.
    return fullName
      .toLowerCase()
      .replaceAll(/(^|[^\p{L}\p{N}_])(\p{L})/gu, (_, before, letter) => before + letter.toUpperCase());
  }