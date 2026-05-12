export default function DisclaimerPage() {
  const year = new Date().getFullYear()

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Intellectual Property Disclaimer</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: May 2026</p>

      <div className="space-y-6 text-gray-700 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Ownership</h2>
          <p>
            This CRM application, including all its source code, design, architecture, features,
            and associated materials, was conceived, designed, and developed by{" "}
            <strong>Tan Jia Jin</strong>. All intellectual property rights in and to this software
            are exclusively owned by Tan Jia Jin. © {year} Tan Jia Jin. All rights reserved.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Restricted Use</h2>
          <p>
            This software is proprietary and confidential. It is licensed for use by Nu Vending
            solely for internal business operations. No part of this application — including but
            not limited to its source code, design, logic, structure, or functionality — may be:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Copied, reproduced, or duplicated in any form</li>
            <li>Modified, adapted, or translated</li>
            <li>Distributed, sublicensed, or transferred to any third party</li>
            <li>Reverse engineered, decompiled, or disassembled</li>
            <li>Used to create derivative works</li>
          </ul>
          <p className="mt-2">
            without the prior written consent of Tan Jia Jin.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">3. No Transfer of Ownership</h2>
          <p>
            Access to or use of this application does not constitute a transfer of ownership or
            any intellectual property rights. The deployment of this software for Nu Vending's
            operations does not grant Nu Vending or any of its employees, directors, or affiliates
            any ownership rights over the software or its underlying code.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Confidentiality</h2>
          <p>
            Users of this system are required to keep all information about the software's design,
            features, and implementation confidential. Unauthorized disclosure of such information
            to competitors or third parties is strictly prohibited.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Enforcement</h2>
          <p>
            Any unauthorized use, reproduction, or distribution of this software or its components
            may result in severe civil and criminal penalties and will be prosecuted to the maximum
            extent permitted by law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Contact</h2>
          <p>
            For licensing inquiries or permissions, please contact the developer at{" "}
            <a href="mailto:jjprime1994@gmail.com" className="text-blue-600 hover:underline">
              jjprime1994@gmail.com
            </a>
          </p>
        </section>
      </div>

      <div className="mt-12 pt-6 border-t border-gray-100 text-xs text-gray-400 text-center">
        © {year} Tan Jia Jin. All rights reserved. This software is proprietary and confidential.
      </div>
    </div>
  )
}
