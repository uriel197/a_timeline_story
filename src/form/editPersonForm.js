// ui/forms/editPersonForm.js
import { saveNode } from "../db/db.js";
import { compressImageToBlob } from "../form/formUtilities.js";

export async function renderEditPersonForm(
  container,
  db,
  person,
  onSaveCallback,
) {
  container.innerHTML = `
    <div class="form-panel">
    <div class="title-bar">EDIT PERSON // ${person.firstName} ${person.lastName}</div>
    
    <form id="edit-person-form" class="origin-form">
      <div class="form-group">
        <label>FIRST NAME</label>
        <input type="text" name="firstName" value="${person.firstName || ""}" required>
      </div>
      <div class="form-group">
        <label>LAST NAME</label>
        <input type="text" name="lastName" value="${person.lastName || ""}" required>
      </div>
      <div class="form-group">
        <label>AGE</label>
        <input type="number" name="age" value="${person.age || ""}">
      </div>
      <div class="form-group">
        <label>RELATIONSHIP STATUS</label>
        <select name="relationshipStatus">
          <option value="single" ${person.relationshipStatus === "single" ? "selected" : ""}>Single</option>
          <option value="married" ${person.relationshipStatus === "married" ? "selected" : ""}>Married</option>
            <option value="ex-spouse" ${person.relationshipStatus === "ex-spouse" ? "selected" : ""}>Divorced / Widowed</option>
            <option value="partner" ${person.relationshipStatus === "partner" ? "selected" : ""}>Unmarried Partner</option>
        </select>
      </div>
      <div class="form-group">
        <label>RELIGIOUS BACKGROUND</label>
        <textarea name="religiousBackground" rows="3">${person.religiousBackground || ""}</textarea>
      </div>
      <div class="form-group">
        <label>INTERESTS</label>
        <textarea name="interests" rows="4">${person.interests || ""}</textarea>
      </div>
      <div class="form-group">
        <label>NEW PROFILE AVATAR (OPTIONAL)</label>
        <input type="file" id="edit-avatar-input" accept="image/*">
      </div>
      <div class="btn-container">
        <button type="submit">SAVE CHANGES</button>
        <button type="button" id="cancel-edit" class="btn-cancel">CANCEL</button>
      </div>
    </form>
    <div/>
  `;

  const form = container.querySelector("#edit-person-form");

  form.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    let newAvatar = person.avatar;
    const avatarFile = document.getElementById("edit-avatar-input").files[0];

    if (avatarFile) {
      try {
        newAvatar = await compressImageToBlob(avatarFile);
      } catch (err) {
        console.error(err);
      }
    }

    const updatedPerson = {
      ...person,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      age: data.age ? parseInt(data.age) : null,
      relationshipStatus: data.relationshipStatus,
      religiousBackground: data.religiousBackground?.trim() || "",
      interests: data.interests?.trim() || "",
      avatar: newAvatar,
      updatedAt: Date.now(),
    };

    try {
      await saveNode(db, updatedPerson);
      alert(
        "Person updated successfully. wait until next refresh to see updated version",
      );
      onSaveCallback();
    } catch (err) {
      alert("Failed to update person.");
    }
  };

  container.querySelector("#cancel-edit").onclick = () => onSaveCallback();
}
